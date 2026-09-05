import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import {
  addPortfolioItem,
  addWatchlistItem,
  deletePortfolioItem,
  deleteWatchlistItem,
  editPortfolioItem,
  getUserData,
  syncUserData,
} from "@/lib/user-data-db";
import {
  holdingToItem,
  sanitizePortfolio,
  sanitizePortfolioItems,
  sanitizeWatchlist,
  sanitizeWatchlistItems,
  type PortfolioItemDTO,
  type WatchlistItemDTO,
} from "@/lib/user-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionUser(session: Session | null) {
  const id = session?.user?.id;
  if (!session?.user || !id) return null;
  return {
    id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  };
}

function parsePortfolioPayload(value: unknown): PortfolioItemDTO[] | null {
  const items = sanitizePortfolioItems(value);
  if (items) return items;
  const snapshot = sanitizePortfolio(value);
  if (!snapshot) return null;
  return snapshot.holdings.map(holdingToItem);
}

function parseWatchlistPayload(value: unknown): WatchlistItemDTO[] | null {
  const items = sanitizeWatchlistItems(value);
  if (items) return items;
  const symbols = sanitizeWatchlist(value);
  if (!symbols) return null;
  return sanitizeWatchlistItems(symbols);
}

export async function GET() {
  const user = sessionUser(await auth());
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getUserData(user);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load user data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = sessionUser(await auth());
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const bag = body as {
    action?: unknown;
    target?: unknown;
    type?: unknown;
    id?: unknown;
    ticker?: unknown;
    item?: unknown;
    portfolio?: unknown;
    watchlist?: unknown;
    portfolioItems?: unknown;
    watchlistItems?: unknown;
  };

  const action = typeof bag.action === "string" ? bag.action : "sync";
  const target = typeof bag.target === "string" ? bag.target : typeof bag.type === "string" ? bag.type : null;

  try {
    if (action === "add") {
      if (target === "watchlist") {
        const items = sanitizeWatchlistItems([bag.item ?? bag.ticker]);
        if (!items?.[0]) return NextResponse.json({ error: "Invalid watchlist item" }, { status: 400 });
        return NextResponse.json(await addWatchlistItem(user, items[0]));
      }
      const items = sanitizePortfolioItems([bag.item]);
      if (!items?.[0]) return NextResponse.json({ error: "Invalid portfolio item" }, { status: 400 });
      return NextResponse.json(await addPortfolioItem(user, items[0]));
    }

    if (action === "edit") {
      const id = typeof bag.id === "string" ? bag.id : null;
      const items = sanitizePortfolioItems([bag.item ?? bag]);
      if (!id && !items?.[0]?.id) {
        return NextResponse.json({ error: "Missing portfolio item id" }, { status: 400 });
      }
      const item = items?.[0];
      return NextResponse.json(
        await editPortfolioItem(user, id ?? item!.id, {
          shares: item?.shares,
          buyPrice: item?.buyPrice,
          buyDate: item?.buyDate,
          companyName: item?.companyName,
        }),
      );
    }

    if (action === "delete") {
      const idOrTicker =
        typeof bag.id === "string" ? bag.id : typeof bag.ticker === "string" ? bag.ticker : null;
      if (!idOrTicker) return NextResponse.json({ error: "Missing id or ticker" }, { status: 400 });
      if (target === "watchlist") {
        return NextResponse.json(await deleteWatchlistItem(user, idOrTicker));
      }
      return NextResponse.json(await deletePortfolioItem(user, idOrTicker));
    }

    const portfolioItems =
      bag.portfolioItems !== undefined
        ? parsePortfolioPayload(bag.portfolioItems)
        : bag.portfolio !== undefined
          ? parsePortfolioPayload(bag.portfolio)
          : undefined;
    const watchlistItems =
      bag.watchlistItems !== undefined
        ? parseWatchlistPayload(bag.watchlistItems)
        : bag.watchlist !== undefined
          ? parseWatchlistPayload(bag.watchlist)
          : undefined;

    if (portfolioItems === null) {
      return NextResponse.json({ error: "Invalid portfolio payload" }, { status: 400 });
    }
    if (watchlistItems === null) {
      return NextResponse.json({ error: "Invalid watchlist payload" }, { status: 400 });
    }
    if (portfolioItems === undefined && watchlistItems === undefined) {
      return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
    }

    return NextResponse.json(await syncUserData(user, { portfolioItems, watchlistItems }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Save failed";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  const user = sessionUser(await auth());
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const target = url.searchParams.get("target") ?? url.searchParams.get("type") ?? "portfolio";
  const idOrTicker = url.searchParams.get("id") ?? url.searchParams.get("ticker");
  if (!idOrTicker) {
    return NextResponse.json({ error: "Missing id or ticker" }, { status: 400 });
  }

  try {
    if (target === "watchlist") {
      return NextResponse.json(await deleteWatchlistItem(user, idOrTicker));
    }
    return NextResponse.json(await deletePortfolioItem(user, idOrTicker));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
