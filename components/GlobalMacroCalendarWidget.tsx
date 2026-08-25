"use client";

import { useMemo, useState } from "react";
import {
  WEEKDAY_LABELS,
  daysInMonth,
  eventCalendarDate,
  formatMonthYear,
  isoFromParts,
  klTodayIso,
  mondayIndex,
  parseIsoDate,
  shiftMonth,
  type DatedMacroEvent,
  type MacroEventKind,
} from "@/lib/global-calendar";
import { MYT_TIME_BADGE_COMPACT_CLASS } from "@/lib/myt";

const KIND_DOT: Record<MacroEventKind, string> = {
  rate: "bg-amber-400 shadow-[0_0_7px_rgba(251,191,36,0.95)]",
  cpi: "bg-emerald-400 shadow-[0_0_7px_rgba(52,211,153,0.95)]",
  other: "bg-sky-400 shadow-[0_0_7px_rgba(56,189,248,0.9)]",
};

const KIND_LABEL: Record<MacroEventKind, string> = {
  rate: "Central bank rate",
  cpi: "CPI release",
  other: "Macro print",
};

type CalendarCell = {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  events: DatedMacroEvent[];
};

type GlobalMacroCalendarWidgetProps = {
  events: DatedMacroEvent[];
  selectedDate: string | null;
  onSelectDate: (iso: string) => void;
  onShowAll: () => void;
};

function buildMonthCells(
  year: number,
  month: number,
  todayIso: string,
  eventsByDate: Map<string, DatedMacroEvent[]>,
): CalendarCell[] {
  const leading = mondayIndex(year, month, 1);
  const count = daysInMonth(year, month);
  const prev = shiftMonth(year, month, -1);
  const prevCount = daysInMonth(prev.year, prev.month);
  const cells: CalendarCell[] = [];

  for (let i = leading; i > 0; i -= 1) {
    const day = prevCount - i + 1;
    const iso = isoFromParts(prev.year, prev.month, day);
    cells.push({
      iso,
      day,
      inMonth: false,
      isToday: iso === todayIso,
      events: eventsByDate.get(iso) ?? [],
    });
  }

  for (let day = 1; day <= count; day += 1) {
    const iso = isoFromParts(year, month, day);
    cells.push({
      iso,
      day,
      inMonth: true,
      isToday: iso === todayIso,
      events: eventsByDate.get(iso) ?? [],
    });
  }

  const next = shiftMonth(year, month, 1);
  let nextDay = 1;
  while (cells.length < 42) {
    const iso = isoFromParts(next.year, next.month, nextDay);
    cells.push({
      iso,
      day: nextDay,
      inMonth: false,
      isToday: iso === todayIso,
      events: eventsByDate.get(iso) ?? [],
    });
    nextDay += 1;
  }

  return cells;
}

export function GlobalMacroCalendarWidget({
  events,
  selectedDate,
  onSelectDate,
  onShowAll,
}: GlobalMacroCalendarWidgetProps) {
  const todayIso = klTodayIso();
  const todayParts = parseIsoDate(todayIso) ?? { year: 2026, month: 8, day: 25 };
  const [{ year, month }, setCursor] = useState(() => {
    const nextEvent =
      events.find((event) => eventCalendarDate(event) >= todayIso) ?? events[0];
    const start = parseIsoDate(nextEvent ? eventCalendarDate(nextEvent) : todayIso);
    return { year: start?.year ?? todayParts.year, month: start?.month ?? todayParts.month };
  });

  const eventsByDate = useMemo(() => {
    const map = new Map<string, DatedMacroEvent[]>();
    for (const event of events) {
      const key = eventCalendarDate(event);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const cells = useMemo(
    () => buildMonthCells(year, month, todayIso, eventsByDate),
    [year, month, todayIso, eventsByDate],
  );

  const thisMonth = todayParts.year === year && todayParts.month === month;
  const nextMonth = shiftMonth(todayParts.year, todayParts.month, 1);
  const isNextMonth = nextMonth.year === year && nextMonth.month === month;
  const selectedCount = selectedDate ? (eventsByDate.get(selectedDate)?.length ?? 0) : 0;

  return (
    <section
      className="flex h-full min-h-0 flex-col border border-neutral-800 bg-[#0d0d0d]"
      aria-label="Macro event month calendar"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-800 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setCursor((cursor) => shiftMonth(cursor.year, cursor.month, -1))}
          className="inline-flex h-9 w-9 items-center justify-center border border-neutral-800 font-mono text-[12px] text-neutral-400 hover:border-amber-500/50 hover:text-amber-300 lg:h-7 lg:w-7"
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="min-w-0 truncate text-center text-[12px] font-semibold uppercase tracking-[0.12em] text-neutral-200">
          {formatMonthYear(year, month)}
        </p>
        <button
          type="button"
          onClick={() => setCursor((cursor) => shiftMonth(cursor.year, cursor.month, 1))}
          className="inline-flex h-9 w-9 items-center justify-center border border-neutral-800 font-mono text-[12px] text-neutral-400 hover:border-amber-500/50 hover:text-amber-300 lg:h-7 lg:w-7"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1 border-b border-neutral-800 px-2.5 py-1.5">
        <button
          type="button"
          aria-pressed={thisMonth}
          onClick={() => setCursor({ year: todayParts.year, month: todayParts.month })}
          className={`min-h-8 rounded-sm border px-2 font-mono text-[9px] uppercase tracking-wider lg:min-h-0 lg:py-0.5 ${
            thisMonth
              ? "border-amber-500/70 bg-amber-500/15 text-amber-300"
              : "border-neutral-800 text-neutral-500 hover:border-amber-500/40 hover:text-amber-300"
          }`}
        >
          This month
        </button>
        <button
          type="button"
          aria-pressed={isNextMonth}
          onClick={() => setCursor(nextMonth)}
          className={`min-h-8 rounded-sm border px-2 font-mono text-[9px] uppercase tracking-wider lg:min-h-0 lg:py-0.5 ${
            isNextMonth
              ? "border-amber-500/70 bg-amber-500/15 text-amber-300"
              : "border-neutral-800 text-neutral-500 hover:border-amber-500/40 hover:text-amber-300"
          }`}
        >
          Next month
        </button>
        {selectedDate ? (
          <button
            type="button"
            onClick={onShowAll}
            className="min-h-8 rounded-sm border border-neutral-700 px-2 font-mono text-[9px] uppercase tracking-wider text-neutral-300 hover:border-amber-500/40 hover:text-amber-300 lg:min-h-0 lg:py-0.5"
          >
            Show all
          </button>
        ) : null}
      </div>

      <div className="grid shrink-0 grid-cols-7 border-b border-neutral-800">
        {WEEKDAY_LABELS.map((label) => (
          <p
            key={label}
            className="py-1 text-center font-mono text-[8px] tracking-[0.14em] text-neutral-600"
          >
            {label}
          </p>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
        {cells.map((cell) => {
          const count = cell.events.length;
          const selected = selectedDate === cell.iso;
          const kinds = [...new Set(cell.events.map((event) => event.kind))];
          const times = cell.events
            .map((event) => event.myt)
            .filter((stamp): stamp is NonNullable<typeof stamp> => stamp != null);
          const eventLabel =
            count === 0
              ? "No events"
              : times.length > 0
                ? `${count} ${count === 1 ? "event" : "events"} · ${times.map((stamp) => stamp.badge).join(", ")}`
                : `${count} ${count === 1 ? "event" : "events"}`;

          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => {
                if (!cell.inMonth) {
                  const parts = parseIsoDate(cell.iso);
                  if (parts) setCursor({ year: parts.year, month: parts.month });
                }
                if (selected) {
                  onShowAll();
                  return;
                }
                onSelectDate(cell.iso);
              }}
              aria-pressed={selected}
              aria-label={`${cell.iso} · ${eventLabel}`}
              title={count > 0 ? `${cell.iso} · ${eventLabel}` : cell.iso}
              className={`relative flex min-h-0 flex-col items-center justify-between border border-neutral-800 px-0.5 py-0.5 transition-colors ${
                selected
                  ? "border-amber-500/80 bg-amber-500/10"
                  : cell.isToday
                    ? "bg-white/[0.03] hover:border-amber-500/50 hover:bg-amber-500/5"
                    : "bg-[#0d0d0d] hover:border-amber-500/50 hover:bg-amber-500/5"
              }`}
            >
              <span
                className={`font-mono text-[11px] leading-none ${
                  selected
                    ? "text-amber-200"
                    : cell.isToday
                      ? "text-amber-300"
                      : cell.inMonth
                        ? "text-neutral-200"
                        : "text-neutral-700"
                }`}
              >
                {cell.day}
              </span>
              {times.length > 0 ? (
                <span className="flex max-w-full flex-col items-center gap-0.5">
                  {cell.events.slice(0, 2).map((event) =>
                    event.myt ? (
                      <span
                        key={event.id}
                        className={MYT_TIME_BADGE_COMPACT_CLASS}
                        title={event.myt.badge}
                      >
                        {event.myt.compact}
                      </span>
                    ) : null,
                  )}
                </span>
              ) : count > 0 ? (
                <span className="rounded-sm bg-amber-500/15 px-1 font-mono text-[7px] uppercase leading-none tracking-wider text-amber-300">
                  {count} {count === 1 ? "event" : "events"}
                </span>
              ) : (
                <span className="h-[10px]" aria-hidden />
              )}
              <span className="flex h-1.5 items-center justify-center gap-0.5" aria-hidden>
                {kinds.map((kind) => (
                  <span
                    key={kind}
                    className={`inline-block h-1.5 w-1.5 rounded-full ${KIND_DOT[kind]}`}
                    title={KIND_LABEL[kind]}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-neutral-800 px-2.5 py-1.5">
        <p className="flex items-center gap-3 font-mono text-[8px] uppercase tracking-wider text-neutral-600">
          <span className="inline-flex items-center gap-1">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${KIND_DOT.rate}`} />
            Rates
          </span>
          <span className="inline-flex items-center gap-1">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${KIND_DOT.cpi}`} />
            CPI
          </span>
        </p>
        <p className="font-mono text-[8px] uppercase tracking-wider text-neutral-600">
          {selectedDate
            ? `${selectedDate} · ${selectedCount} ${selectedCount === 1 ? "event" : "events"}`
            : "Tap a date to filter"}
        </p>
      </div>
    </section>
  );
}
