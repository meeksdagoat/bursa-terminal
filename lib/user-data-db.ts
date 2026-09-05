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

export async function ensureUser(user: SessionUser) {
  return prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      image: user.image ?? null,
    },
    update: {
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      image: user.image ?? undefined,
    },
  });
}

export async function getUserData(user: SessionUser): Promise<UserDataResponse> {
  const record = await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      email: user.email ?? null,
      name: user.name ?? null,
      image: user.image ?? null,
    },
    update: {
      email: user.email ?? undefined,
      name: user.name ?? undefined,
      image: user.image ?? undefined,
    },
    include: {
      portfolioItems: { orderBy: { createdAt: "asc" } },
      watchlistItems: { orderBy: { addedAt: "asc" } },
    },
  });

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
  await ensureUser(user);

  await prisma.$transaction(async (tx) => {
    if (patch.portfolioItems) {
      await tx.portfolioItem.deleteMany({ where: { userId: user.id } });
      if (patch.portfolioItems.length > 0) {
        await tx.portfolioItem.createMany({
          data: patch.portfolioItems.map((item) => ({
            id: item.id,
            userId: user.id,
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
      await tx.watchlistItem.deleteMany({ where: { userId: user.id } });
      if (patch.watchlistItems.length > 0) {
        await tx.watchlistItem.createMany({
          data: patch.watchlistItems.map((item, index) => ({
            id: item.id,
            userId: user.id,
            ticker: item.ticker,
            companyName: item.companyName || companyNameFor(item.ticker),
            addedAt: item.addedAt ? new Date(item.addedAt) : new Date(Date.now() + index),
          })),
        });
      }
    }

    await tx.user.update({
      where: { id: user.id },
      data: { initialized: true },
    });
  });

  return getUserData(user);
}

export async function addPortfolioItem(user: SessionUser, item: PortfolioItemDTO): Promise<UserDataResponse> {
  await ensureUser(user);
  await prisma.portfolioItem.upsert({
    where: { userId_ticker: { userId: user.id, ticker: item.ticker } },
    create: {
      id: item.id,
      userId: user.id,
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
  await markInitialized(user.id);
  return getUserData(user);
}

export async function editPortfolioItem(
  user: SessionUser,
  id: string,
  patch: Partial<Pick<PortfolioItemDTO, "shares" | "buyPrice" | "buyDate" | "companyName">>,
): Promise<UserDataResponse> {
  const existing = await prisma.portfolioItem.findFirst({ where: { id, userId: user.id } });
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
  await prisma.portfolioItem.deleteMany({
    where: {
      userId: user.id,
      OR: [{ id: idOrTicker }, { ticker: idOrTicker }],
    },
  });
  await markInitialized(user.id);
  return getUserData(user);
}

export async function addWatchlistItem(user: SessionUser, item: WatchlistItemDTO): Promise<UserDataResponse> {
  await ensureUser(user);
  await prisma.watchlistItem.upsert({
    where: { userId_ticker: { userId: user.id, ticker: item.ticker } },
    create: {
      id: item.id,
      userId: user.id,
      ticker: item.ticker,
      companyName: item.companyName || companyNameFor(item.ticker),
      addedAt: item.addedAt ? new Date(item.addedAt) : new Date(),
    },
    update: {
      companyName: item.companyName || companyNameFor(item.ticker),
    },
  });
  await markInitialized(user.id);
  return getUserData(user);
}

export async function deleteWatchlistItem(user: SessionUser, idOrTicker: string): Promise<UserDataResponse> {
  await prisma.watchlistItem.deleteMany({
    where: {
      userId: user.id,
      OR: [{ id: idOrTicker }, { ticker: idOrTicker }],
    },
  });
  await markInitialized(user.id);
  return getUserData(user);
}
