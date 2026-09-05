import { prisma } from "./prisma";
import { toDateInputValue } from "./portfolio";
import {
  companyNameFor,
  snapshotFromItems,
  type PortfolioItemDTO,
  type UserDataResponse,
  type WatchlistItemDTO,
} from "./user-data";

export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

function toDate(value: string): Date {
  const iso = toDateInputValue(value);
  return new Date(`${iso}T00:00:00.000Z`);
}

function toPortfolioDto(row: {
  id: string;
  ticker: string;
  companyName: string;
  shares: number;
  buyPrice: number;
  buyDate: Date;
}): PortfolioItemDTO {
  return {
    id: row.id,
    ticker: row.ticker,
    companyName: row.companyName,
    shares: row.shares,
    buyPrice: row.buyPrice,
    buyDate: toDateInputValue(row.buyDate.toISOString()),
  };
}

function toWatchlistDto(row: {
  id: string;
  ticker: string;
  companyName: string;
  addedAt: Date;
}): WatchlistItemDTO {
  return {
    id: row.id,
    ticker: row.ticker,
    companyName: row.companyName,
    addedAt: row.addedAt.toISOString(),
  };
}

const userWithItems = {
  portfolioItems: { orderBy: { createdAt: "asc" as const } },
  watchlistItems: { orderBy: { addedAt: "asc" as const } },
};

async function resolveUser(user: SessionUser) {
  const email = user.email?.trim() || null;
  const existing = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findUnique({ where: { id: user.id } });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        name: user.name ?? existing.name,
        image: user.image ?? existing.image,
      },
      include: userWithItems,
    });
  }

  return prisma.user.create({
    data: {
      id: user.id,
      email,
      name: user.name ?? null,
      image: user.image ?? null,
    },
    include: userWithItems,
  });
}

export async function ensureUser(user: SessionUser) {
  return resolveUser(user);
}

async function accountId(user: SessionUser): Promise<string> {
  return (await resolveUser(user)).id;
}

export async function getUserData(user: SessionUser): Promise<UserDataResponse> {
  const record = await resolveUser(user);

  const portfolioItems = record.portfolioItems.map(toPortfolioDto);
  const watchlistItems = record.watchlistItems.map(toWatchlistDto);
  const snapshot = snapshotFromItems(portfolioItems, watchlistItems);

  return {
    ...snapshot,
    portfolioItems,
    watchlistItems,
    initialized: record.initialized,
  };
}

export async function markInitialized(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { initialized: true },
  });
}

export async function syncUserData(
  user: SessionUser,
  patch: { portfolioItems?: PortfolioItemDTO[]; watchlistItems?: WatchlistItemDTO[] },
): Promise<UserDataResponse> {
  const userId = await accountId(user);

  await prisma.$transaction(async (tx) => {
    if (patch.portfolioItems) {
      await tx.portfolioItem.deleteMany({ where: { userId } });
      if (patch.portfolioItems.length > 0) {
        await tx.portfolioItem.createMany({
          data: patch.portfolioItems.map((item) => ({
            id: item.id,
            userId,
            ticker: item.ticker,
            companyName: item.companyName || companyNameFor(item.ticker),
            shares: item.shares,
            buyPrice: item.buyPrice,
            buyDate: toDate(item.buyDate),
          })),
        });
      }
    }

    if (patch.watchlistItems) {
      await tx.watchlistItem.deleteMany({ where: { userId } });
      if (patch.watchlistItems.length > 0) {
        await tx.watchlistItem.createMany({
          data: patch.watchlistItems.map((item, index) => ({
            id: item.id,
            userId,
            ticker: item.ticker,
            companyName: item.companyName || companyNameFor(item.ticker),
            addedAt: item.addedAt ? new Date(item.addedAt) : new Date(Date.now() + index),
          })),
        });
      }
    }

    await tx.user.update({
      where: { id: userId },
      data: { initialized: true },
    });
  });

  return getUserData(user);
}

export async function addPortfolioItem(user: SessionUser, item: PortfolioItemDTO): Promise<UserDataResponse> {
  const userId = await accountId(user);
  await prisma.portfolioItem.upsert({
    where: { userId_ticker: { userId, ticker: item.ticker } },
    create: {
      id: item.id,
      userId,
      ticker: item.ticker,
      companyName: item.companyName || companyNameFor(item.ticker),
      shares: item.shares,
      buyPrice: item.buyPrice,
      buyDate: toDate(item.buyDate),
    },
    update: {
      companyName: item.companyName || companyNameFor(item.ticker),
      shares: item.shares,
      buyPrice: item.buyPrice,
      buyDate: toDate(item.buyDate),
    },
  });
  await markInitialized(userId);
  return getUserData(user);
}

export async function editPortfolioItem(
  user: SessionUser,
  id: string,
  patch: Partial<Pick<PortfolioItemDTO, "shares" | "buyPrice" | "buyDate" | "companyName">>,
): Promise<UserDataResponse> {
  const userId = await accountId(user);
  const existing = await prisma.portfolioItem.findFirst({ where: { id, userId } });
  if (!existing) {
    throw new Error("Portfolio item not found");
  }

  await prisma.portfolioItem.update({
    where: { id },
    data: {
      shares: patch.shares ?? existing.shares,
      buyPrice: patch.buyPrice ?? existing.buyPrice,
      buyDate: patch.buyDate ? toDate(patch.buyDate) : existing.buyDate,
      companyName: patch.companyName ?? existing.companyName,
    },
  });
  return getUserData(user);
}

export async function deletePortfolioItem(user: SessionUser, idOrTicker: string): Promise<UserDataResponse> {
  const userId = await accountId(user);
  await prisma.portfolioItem.deleteMany({
    where: {
      userId,
      OR: [{ id: idOrTicker }, { ticker: idOrTicker }],
    },
  });
  await markInitialized(userId);
  return getUserData(user);
}

export async function addWatchlistItem(user: SessionUser, item: WatchlistItemDTO): Promise<UserDataResponse> {
  const userId = await accountId(user);
  await prisma.watchlistItem.upsert({
    where: { userId_ticker: { userId, ticker: item.ticker } },
    create: {
      id: item.id,
      userId,
      ticker: item.ticker,
      companyName: item.companyName || companyNameFor(item.ticker),
      addedAt: item.addedAt ? new Date(item.addedAt) : new Date(),
    },
    update: {
      companyName: item.companyName || companyNameFor(item.ticker),
    },
  });
  await markInitialized(userId);
  return getUserData(user);
}

export async function deleteWatchlistItem(user: SessionUser, idOrTicker: string): Promise<UserDataResponse> {
  const userId = await accountId(user);
  await prisma.watchlistItem.deleteMany({
    where: {
      userId,
      OR: [{ id: idOrTicker }, { ticker: idOrTicker }],
    },
  });
  await markInitialized(userId);
  return getUserData(user);
}
