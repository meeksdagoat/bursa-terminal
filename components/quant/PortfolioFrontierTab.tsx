"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  formatQuantAssetLabel,
  QUANT_ASSET_FILTER_PILLS,
  searchQuantAssets,
  type QuantAssetFilter,
} from "@/constants/quantAssets";
import {
  categoryBadge,
  resolveQuantAsset,
  type QuantAsset,
  type QuantAssetCategory,
} from "@/lib/quant/asset-catalog";
import {
  DEFAULT_FRONTIER_SYMBOLS,
  FRONTIER_PORTFOLIO_PRESETS,
  MAX_FRONTIER_SYMBOLS,
  MIN_FRONTIER_SYMBOLS,
  USD_MYR_FX_SYMBOL,
  alignReturnMatrix,
  formatWeightPct,
  portfolioForRiskTolerance,
  portfolioNeedsFxConversion,
  simulateEfficientFrontier,
  type FrontierBaseCurrency,
  type FrontierResult,
  type PortfolioPoint,
} from "@/lib/quant/portfolio";
import { normalizeTradingDate, unixToDate } from "@/lib/quant/math";
import type { DailyClose, HistoryPayload } from "@/lib/types";

const PANEL = "rounded border border-neutral-800 bg-[#0d0d0d] p-3";
const TAB_PILL_ACTIVE = "border-amber-500/50 bg-amber-500/15 text-amber-400";
const TAB_PILL_IDLE =
  "border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-300";
const ADD_RESULT_LIMIT = 24;
const DEFAULT_INVESTMENT_CAPITAL = 10_000;
const MIN_INVESTMENT_CAPITAL = 1_000;

function formatFrontierMoney(value: number, currency: FrontierBaseCurrency): string {
  const formatter = new Intl.NumberFormat(currency === "MYR" ? "en-MY" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "MYR" ? `RM ${formatter.format(value)}` : `$${formatter.format(value)}`;
}

function formatFrontierSignedReturnPct(value: number): string {
  const pct = value * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function historyFromDate(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function fetchHistory(symbols: string[], from: string): Promise<HistoryPayload> {
  const response = await fetch(
    `/api/history?symbols=${encodeURIComponent(symbols.join(","))}&from=${from}`,
  );
  const body = (await response.json()) as HistoryPayload | { error?: string };
  if (!response.ok) {
    throw new Error("error" in body ? String(body.error) : `HTTP ${response.status}`);
  }
  return body as HistoryPayload;
}

function closesToFxMap(points: DailyClose[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const point of points) {
    if (!Number.isFinite(point.close) || point.close <= 0) continue;
    map.set(normalizeTradingDate(unixToDate(point.time)), point.close);
  }
  return map;
}

function formatAssetChipLabel(symbol: string): string {
  const asset = resolveQuantAsset(symbol);
  return asset ? formatQuantAssetLabel(asset) : symbol;
}

export function PortfolioFrontierTab() {
  const [symbols, setSymbols] = useState<string[]>([...DEFAULT_FRONTIER_SYMBOLS]);
  const [baseCurrency, setBaseCurrency] = useState<FrontierBaseCurrency>("MYR");
  const [investmentCapital, setInvestmentCapital] = useState(DEFAULT_INVESTMENT_CAPITAL);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [riskTolerance, setRiskTolerance] = useState(0.5);
  const [frontier, setFrontier] = useState<FrontierResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addSymbol = useCallback((symbol: string) => {
    setActivePreset(null);
    setSymbols((current) => {
      if (current.includes(symbol) || current.length >= MAX_FRONTIER_SYMBOLS) return current;
      return [...current, symbol];
    });
  }, []);

  const removeSymbol = useCallback((symbol: string) => {
    setActivePreset(null);
    setSymbols((current) => {
      if (current.length <= MIN_FRONTIER_SYMBOLS) return current;
      return current.filter((item) => item !== symbol);
    });
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = FRONTIER_PORTFOLIO_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setActivePreset(presetId);
    setSymbols([...preset.symbols].slice(0, MAX_FRONTIER_SYMBOLS));
  }, []);

  useEffect(() => {
    if (symbols.length < MIN_FRONTIER_SYMBOLS) {
      setFrontier(null);
      setLoading(false);
      setError(`Select at least ${MIN_FRONTIER_SYMBOLS} assets`);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const needsFx = portfolioNeedsFxConversion(symbols, baseCurrency);
    const fetchSymbols = needsFx
      ? [...new Set([...symbols, USD_MYR_FX_SYMBOL])]
      : symbols;

    void fetchHistory(fetchSymbols, historyFromDate(365 * 2))
      .then((body) => {
        if (cancelled) return;

        const seriesBySymbol = Object.fromEntries(
          symbols.map((symbol) => [symbol, body.series[symbol] ?? []]),
        );
        const fxSeries = needsFx
          ? closesToFxMap(body.series[USD_MYR_FX_SYMBOL] ?? [])
          : undefined;

        const matrix = alignReturnMatrix(seriesBySymbol, {
          baseCurrency,
          fxSeries,
        });

        if (!matrix) {
          setFrontier(null);
          setError(
            "Need at least 60 overlapping trading days across selected assets (multi-calendar alignment).",
          );
          return;
        }

        setFrontier(simulateEfficientFrontier(matrix));
      })
      .catch((cause) => {
        if (cancelled) return;
        setFrontier(null);
        setError(cause instanceof Error ? cause.message : "Frontier simulation failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbols, baseCurrency]);

  const selectedPortfolio = useMemo(() => {
    if (!frontier) return null;
    return portfolioForRiskTolerance(frontier, riskTolerance);
  }, [frontier, riskTolerance]);

  const riskTolerancePoint = useMemo(() => {
    if (!selectedPortfolio) return null;
    return {
      risk: selectedPortfolio.risk * 100,
      expectedReturn: selectedPortfolio.expectedReturn * 100,
      sharpe: selectedPortfolio.sharpe,
    };
  }, [selectedPortfolio]);

  const scatterData = useMemo(
    () =>
      (frontier?.points ?? []).map((point) => ({
        risk: point.risk * 100,
        expectedReturn: point.expectedReturn * 100,
        sharpe: point.sharpe,
      })),
    [frontier?.points],
  );

  return (
    <section className={`flex flex-col gap-3 ${PANEL}`}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
                Preset Portfolios
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {FRONTIER_PORTFOLIO_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset.id)}
                    className={`rounded border px-2 py-1 font-mono text-[10px] transition-colors ${
                      activePreset === preset.id ? TAB_PILL_ACTIVE : TAB_PILL_IDLE
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <fieldset className="flex flex-col gap-1">
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
                  Base Currency
                </span>
                <div className="inline-flex rounded border border-neutral-800 bg-[#111111] p-0.5">
                  {(["MYR", "USD"] as const).map((currency) => (
                    <button
                      key={currency}
                      type="button"
                      onClick={() => setBaseCurrency(currency)}
                      className={`rounded px-2.5 py-1 font-mono text-[10px] transition-colors ${
                        baseCurrency === currency
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "text-neutral-500 hover:text-neutral-300"
                      }`}
                    >
                      {currency}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="flex min-w-[9rem] flex-col gap-1">
                <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
                  Investment Capital
                </span>
                <div className="flex items-center gap-1.5 rounded border border-neutral-800 bg-[#111111] px-2 py-1.5">
                  <span className="shrink-0 font-mono text-[10px] text-neutral-500">
                    {baseCurrency === "MYR" ? "RM" : "$"}
                  </span>
                  <input
                    type="number"
                    min={MIN_INVESTMENT_CAPITAL}
                    step={1000}
                    value={investmentCapital}
                    onChange={(event) =>
                      setInvestmentCapital(
                        Math.max(MIN_INVESTMENT_CAPITAL, Number(event.target.value) || DEFAULT_INVESTMENT_CAPITAL),
                      )
                    }
                    className="min-w-0 flex-1 border-0 bg-transparent p-0 font-mono text-xs text-neutral-200 outline-none"
                    aria-label="Investment capital"
                  />
                </div>
                <span className="font-mono text-[8px] text-neutral-600">
                  {formatFrontierMoney(investmentCapital, baseCurrency)}
                </span>
              </label>
            </div>
          </div>

          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
              Multi-Asset Universe ({MIN_FRONTIER_SYMBOLS}–{MAX_FRONTIER_SYMBOLS} names)
            </p>
            <p className="mt-0.5 font-mono text-[9px] text-neutral-600">
              Bursa · US/Nasdaq · Commodities/FX
            </p>

            {symbols.length < MAX_FRONTIER_SYMBOLS ? (
              <div className="mt-1.5">
                <FrontierAssetAddCombobox
                  selected={symbols}
                  onAdd={addSymbol}
                  disabled={symbols.length >= MAX_FRONTIER_SYMBOLS}
                />
              </div>
            ) : (
              <p className="mt-1.5 font-mono text-[9px] text-amber-400">
                Maximum {MAX_FRONTIER_SYMBOLS} assets reached — remove one to add another.
              </p>
            )}
          </div>
        </div>

        <SelectedAssetsSidebar
          symbols={symbols}
          onRemove={removeSymbol}
          minSymbols={MIN_FRONTIER_SYMBOLS}
          maxSymbols={MAX_FRONTIER_SYMBOLS}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
          Risk Tolerance
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(riskTolerance * 100)}
          onChange={(event) => setRiskTolerance(Number(event.target.value) / 100)}
          className="h-1.5 w-full cursor-pointer accent-amber-400"
        />
        <span className="font-mono text-[10px] text-neutral-500">
          Conservative ← {Math.round(riskTolerance * 100)}% risk appetite → Aggressive
          {selectedPortfolio ? (
            <span className="text-amber-400/90">
              {" "}
              · E(Rp) {formatFrontierSignedReturnPct(selectedPortfolio.expectedReturn)} (
              {formatFrontierMoney(
                investmentCapital * selectedPortfolio.expectedReturn,
                baseCurrency,
              )}
              )
            </span>
          ) : null}
        </span>
      </div>

      {error ? (
        <p className="rounded border border-loss/30 bg-loss/10 px-2 py-1 font-mono text-[10px] text-loss">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="h-[360px] animate-pulse rounded border border-neutral-800 bg-[#111111]" />
      ) : frontier ? (
        <>
          <p className="font-mono text-[9px] text-neutral-600">
            {frontier.points.length.toLocaleString()} random long-only portfolios ·{" "}
            {frontier.alignedDays} aligned trading days · {frontier.symbols.length}×
            {frontier.symbols.length} covariance · log returns in {frontier.baseCurrency}
            {portfolioNeedsFxConversion(frontier.symbols, frontier.baseCurrency)
              ? ` · FX via ${USD_MYR_FX_SYMBOL}`
              : ""}
          </p>

          <div className="flex flex-wrap gap-3 font-mono text-[9px] text-neutral-600">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#4ade80]" aria-hidden />
              Max Sharpe
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#22d3ee]" aria-hidden />
              Min Variance
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#525252]" aria-hidden />
              Monte Carlo cloud
            </span>
          </div>

          <div className="h-[360px] rounded border border-neutral-800 bg-[#111111] p-2">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 8, right: 12, left: 8, bottom: 16 }}>
                <CartesianGrid stroke="#1f1f1f" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="risk"
                  name="Risk"
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#262626" }}
                  tickLine={false}
                  label={{
                    value: "Risk (Ann. Volatility σp %)",
                    position: "insideBottom",
                    offset: -4,
                    fill: "#525252",
                    fontSize: 10,
                    fontFamily: "monospace",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="expectedReturn"
                  name="Return"
                  tick={{ fill: "#737373", fontSize: 10, fontFamily: "monospace" }}
                  axisLine={{ stroke: "#262626" }}
                  tickLine={false}
                  width={48}
                  label={{
                    value: "Expected Return E(Rp) %",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#525252",
                    fontSize: 10,
                    fontFamily: "monospace",
                  }}
                />
                <ZAxis range={[20, 20]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0]?.payload as {
                      risk: number;
                      expectedReturn: number;
                      sharpe: number;
                    };
                    return (
                      <div className="rounded border border-neutral-800 bg-neutral-950/90 px-2 py-1.5 font-mono text-[10px]">
                        <p className="text-neutral-400">σp {row.risk.toFixed(2)}%</p>
                        <p className="text-gain">E(Rp) {row.expectedReturn.toFixed(2)}%</p>
                        <p className="text-amber-400">Sharpe {row.sharpe.toFixed(2)}</p>
                      </div>
                    );
                  }}
                />
                <Scatter data={scatterData} fill="#525252" fillOpacity={0.35} />
                <Scatter
                  data={[
                    {
                      risk: frontier.minVariance.risk * 100,
                      expectedReturn: frontier.minVariance.expectedReturn * 100,
                      sharpe: frontier.minVariance.sharpe,
                    },
                  ]}
                  fill="#22d3ee"
                  shape={MinVarianceDot}
                />
                <Scatter
                  data={[
                    {
                      risk: frontier.maxSharpe.risk * 100,
                      expectedReturn: frontier.maxSharpe.expectedReturn * 100,
                      sharpe: frontier.maxSharpe.sharpe,
                    },
                  ]}
                  fill="#4ade80"
                  shape={MaxSharpeDot}
                />
                {riskTolerancePoint ? (
                  <Scatter
                    name="Risk Tolerance"
                    data={[riskTolerancePoint]}
                    shape={RiskToleranceDot}
                    isAnimationActive
                    animationDuration={160}
                    animationEasing="ease-out"
                  />
                ) : null}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-2 lg:grid-cols-2">
            <AllocationCard
              title="Max Sharpe Portfolio"
              titleClass="text-gain"
              portfolio={frontier.maxSharpe}
              symbols={frontier.symbols}
              weights={frontier.maxSharpe.weights}
              baseCurrency={frontier.baseCurrency}
              investmentCapital={investmentCapital}
            />
            <AllocationCard
              title="Min Variance Portfolio"
              titleClass="text-cyan-400"
              portfolio={frontier.minVariance}
              symbols={frontier.symbols}
              weights={frontier.minVariance.weights}
              baseCurrency={frontier.baseCurrency}
              investmentCapital={investmentCapital}
            />
          </div>

          {selectedPortfolio ? (
            <AllocationCard
              title={`Optimal Allocation · Risk Tolerance ${Math.round(riskTolerance * 100)}%`}
              titleClass="text-amber-400"
              panelClass="border-amber-400/20 bg-amber-400/5"
              portfolio={selectedPortfolio}
              symbols={frontier.symbols}
              weights={selectedPortfolio.weights}
              baseCurrency={frontier.baseCurrency}
              investmentCapital={investmentCapital}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function FrontierAssetAddCombobox({
  selected,
  onAdd,
  disabled,
}: {
  selected: string[];
  onAdd: (symbol: string) => void;
  disabled?: boolean;
}) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<QuantAssetFilter>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const { results, totalMatches } = useMemo(() => {
    const searched = searchQuantAssets(query, filter, ADD_RESULT_LIMIT);
    return {
      results: searched.results.filter((asset) => !selected.includes(asset.symbol)),
      totalMatches: searched.totalMatches,
    };
  }, [query, filter, selected]);

  const active = results[activeIndex] ?? null;

  useEffect(() => {
    setActiveIndex(0);
  }, [query, filter]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (wrapRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function pick(asset: QuantAsset) {
    onAdd(asset.symbol);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key === "ArrowDown" && results.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index + 1) % results.length);
      return;
    }
    if (event.key === "ArrowUp" && results.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
      return;
    }
    if (event.key === "Enter" && open && active) {
      event.preventDefault();
      pick(active);
    }
  }

  const filterPills = QUANT_ASSET_FILTER_PILLS;

  return (
    <div ref={wrapRef} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {filterPills.map((pill) => (
          <button
            key={pill.id}
            type="button"
            onClick={() => {
              setFilter(pill.id);
              setOpen(true);
            }}
            className={`rounded border px-2 py-0.5 font-mono text-[9px] transition-colors ${
              filter === pill.id ? TAB_PILL_ACTIVE : TAB_PILL_IDLE
            }`}
          >
            {pill.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <input
          ref={inputRef}
          id={`${listId}-input`}
          type="search"
          role="combobox"
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          aria-expanded={open}
          aria-controls={listId}
          placeholder="Add asset — Maybank 1155, NVDA, AAPL, Gold GC=F, USD/MYR…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-md border border-neutral-800 bg-[#121212] px-3 py-2 font-mono text-xs text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none disabled:opacity-50"
        />

        {open && !disabled ? (
          <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border border-neutral-800 bg-[#141414] shadow-2xl">
            <p className="border-b border-neutral-800 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-neutral-500">
              {query.trim()
                ? `${totalMatches.toLocaleString()} matches`
                : `Browse ${totalMatches.toLocaleString()} assets`}
            </p>
            <ul id={listId} role="listbox" className="max-h-52 overflow-y-auto overscroll-contain">
              {results.length === 0 ? (
                <li className="px-2.5 py-2 font-mono text-[10px] text-neutral-600">NO MATCHES</li>
              ) : (
                results.map((asset, index) => {
                  const badge = categoryBadge(asset.category);
                  return (
                    <li key={asset.symbol} role="presentation">
                      <button
                        type="button"
                        role="option"
                        aria-selected={index === activeIndex}
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => pick(asset)}
                        className={`flex w-full items-center gap-2 px-2.5 py-2 text-left font-mono text-[10px] transition-colors ${
                          index === activeIndex
                            ? "bg-neutral-800/60 text-zinc-100"
                            : "text-zinc-300 hover:bg-neutral-800/60"
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">{formatQuantAssetLabel(asset)}</span>
                        <span
                          className={`shrink-0 rounded border px-1 py-0.5 text-[8px] font-semibold uppercase tracking-[0.12em] ${badge.className}`}
                        >
                          [{badge.label}]
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SelectedAssetsSidebar({
  symbols,
  onRemove,
  minSymbols,
  maxSymbols,
}: {
  symbols: string[];
  onRemove: (symbol: string) => void;
  minSymbols: number;
  maxSymbols: number;
}) {
  const canRemove = symbols.length > minSymbols;

  return (
    <aside className="flex min-h-0 flex-col rounded border border-neutral-800 bg-[#111111] p-2.5 lg:sticky lg:top-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">
        Selected Assets ({symbols.length}/{maxSymbols})
      </p>

      <div className="custom-scrollbar mt-2 max-h-[220px] overflow-y-auto pr-0.5">
        <ul className="flex flex-col gap-2">
          {symbols.map((symbol) => (
            <li key={symbol}>
              <SelectedAssetRow
                symbol={symbol}
                onRemove={() => onRemove(symbol)}
                canRemove={canRemove}
              />
            </li>
          ))}
        </ul>
      </div>

      {!canRemove ? (
        <p className="mt-2 font-mono text-[8px] leading-snug text-neutral-600">
          Minimum {minSymbols} assets required for frontier simulation.
        </p>
      ) : null}
    </aside>
  );
}

function SelectedAssetRow({
  symbol,
  onRemove,
  canRemove,
}: {
  symbol: string;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const asset = resolveQuantAsset(symbol);
  const badge = asset ? categoryBadge(asset.category) : null;

  return (
    <div className="flex w-full items-center gap-2 rounded border border-neutral-800 bg-[#0d0d0d] px-2 py-1.5">
      {badge ? (
        <span
          className={`shrink-0 rounded border px-1 py-0.5 text-[7px] font-semibold uppercase tracking-[0.1em] ${badge.className}`}
        >
          {badge.label}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-neutral-200">
        {formatAssetChipLabel(symbol)}
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Remove ${symbol}`}
        className="shrink-0 rounded px-1.5 py-0.5 font-mono text-xs leading-none text-neutral-500 transition hover:bg-neutral-800 hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        ✕
      </button>
    </div>
  );
}

type FrontierMarkerDotProps = {
  cx?: number;
  cy?: number;
};

function MinVarianceDot({ cx, cy }: FrontierMarkerDotProps) {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={5} fill="#22d3ee" stroke="#ffffff" strokeWidth={1.5} />;
}

function MaxSharpeDot({ cx, cy }: FrontierMarkerDotProps) {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={5} fill="#4ade80" stroke="#ffffff" strokeWidth={1.5} />;
}

function RiskToleranceDot({ cx, cy }: FrontierMarkerDotProps) {
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill="#f59e0b" fillOpacity={0.22}>
        <animate attributeName="r" values="8;12;8" dur="2.2s" repeatCount="indefinite" />
        <animate
          attributeName="fill-opacity"
          values="0.35;0.12;0.35"
          dur="2.2s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx={cx} cy={cy} r={7} fill="#f59e0b" stroke="#ffffff" strokeWidth={2} />
    </g>
  );
}

function AllocationCard({
  title,
  titleClass,
  panelClass = "border-neutral-800 bg-[#111111]",
  portfolio,
  symbols,
  weights,
  baseCurrency,
  investmentCapital,
}: {
  title: string;
  titleClass: string;
  panelClass?: string;
  portfolio: PortfolioPoint;
  symbols: string[];
  weights: number[];
  baseCurrency: FrontierBaseCurrency;
  investmentCapital: number;
}) {
  const expectedReturnDollar = investmentCapital * portfolio.expectedReturn;
  const riskExposureDollar = investmentCapital * portfolio.risk;

  const rows = symbols
    .map((symbol, index) => ({
      symbol,
      weight: weights[index] ?? 0,
      asset: resolveQuantAsset(symbol),
    }))
    .filter((row) => row.weight > 0.001)
    .sort((left, right) => right.weight - left.weight);

  return (
    <article className={`rounded border p-2.5 ${panelClass}`}>
      <p className={`font-mono text-[9px] uppercase tracking-[0.12em] ${titleClass}`}>{title}</p>

      <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 border-b border-neutral-800 pb-2 sm:grid-cols-2">
        <div>
          <dt className="font-mono text-[8px] uppercase tracking-[0.1em] text-neutral-600">
            Total Capital Allocated
          </dt>
          <dd className="font-mono text-[11px] font-semibold tabular-nums text-neutral-100">
            {formatFrontierMoney(investmentCapital, baseCurrency)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[8px] uppercase tracking-[0.1em] text-neutral-600">
            Sharpe Ratio
          </dt>
          <dd className="font-mono text-[11px] font-semibold tabular-nums text-amber-400">
            {portfolio.sharpe.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[8px] uppercase tracking-[0.1em] text-neutral-600">
            Expected Return
          </dt>
          <dd className="font-mono text-[10px] tabular-nums text-gain">
            {formatFrontierSignedReturnPct(portfolio.expectedReturn)} (
            {formatFrontierMoney(expectedReturnDollar, baseCurrency)})
          </dd>
        </div>
        <div>
          <dt className="font-mono text-[8px] uppercase tracking-[0.1em] text-neutral-600">
            Expected Volatility / Risk
          </dt>
          <dd className="font-mono text-[10px] tabular-nums text-neutral-300">
            {(portfolio.risk * 100).toFixed(2)}% (
            {formatFrontierMoney(riskExposureDollar, baseCurrency)} risk exposure)
          </dd>
        </div>
      </dl>

      <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.1em] text-neutral-600">
        Asset Allocation
      </p>
      <ul className="mt-1 space-y-1.5">
        {rows.length === 0 ? (
          <li className="font-mono text-[10px] text-neutral-600">No material weights</li>
        ) : (
          rows.map((row) => {
            const allocationDollar = investmentCapital * row.weight;
            return (
              <li
                key={row.symbol}
                className="flex items-center justify-between gap-2 font-mono text-[10px] text-neutral-300"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {row.asset ? <CategoryBadge category={row.asset.category} /> : null}
                  <span className="truncate">{formatAssetChipLabel(row.symbol)}</span>
                </span>
                <span className="shrink-0 tabular-nums whitespace-nowrap">
                  <span className="text-amber-400">{formatWeightPct(row.weight)}</span>
                  <span className="mx-1 text-neutral-600">→</span>
                  <span className="text-neutral-200">
                    {formatFrontierMoney(allocationDollar, baseCurrency)}
                  </span>
                </span>
              </li>
            );
          })
        )}
      </ul>
    </article>
  );
}

function CategoryBadge({ category }: { category: QuantAssetCategory }) {
  const badge = categoryBadge(category);
  return (
    <span
      className={`shrink-0 rounded border px-1 py-0.5 text-[7px] font-semibold uppercase tracking-[0.1em] ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}
