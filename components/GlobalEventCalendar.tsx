"use client";

import { useMemo, useState } from "react";
import { GlobalMacroCalendarWidget } from "@/components/GlobalMacroCalendarWidget";
import { Eli5Block } from "@/components/eli5-summary";
import { summariseMacroEvent } from "@/lib/eli5";
import { formatKlDate } from "@/lib/format";
import { allGlobalMacroEvents, eventCalendarDate, klTodayIso } from "@/lib/global-calendar";
import { MYT_LABEL, MYT_TIME_BADGE_CLASS } from "@/lib/myt";

/**
 * Two-column Global Event Calendar: chronological list + month widget.
 * Lives in the Global Economy desk under the tape / matrix row.
 */
export function GlobalEventCalendar() {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const catalog = useMemo(() => allGlobalMacroEvents(), []);
  const today = klTodayIso();

  const visible = useMemo(() => {
    if (selectedDate) {
      return catalog.filter((event) => eventCalendarDate(event) === selectedDate);
    }
    return catalog.filter((event) => eventCalendarDate(event) >= today);
  }, [catalog, selectedDate, today]);

  return (
    <div className="flex h-full min-h-[200px] min-w-0 flex-col overflow-hidden bg-panel">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line p-3 sm:px-3 sm:py-2">
        <div className="min-w-0">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Global Event Calendar
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">
            FOMC · US CPI · ECB · BOJ · PBOC LPR
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-emerald-800/50 bg-emerald-950/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-400">
            {MYT_LABEL}
          </span>
          {selectedDate ? (
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="min-h-8 shrink-0 rounded-sm border border-neutral-700 px-2 font-mono text-[9px] uppercase tracking-wider text-neutral-300 hover:border-amber-500/40 hover:text-amber-300 lg:min-h-0 lg:py-1"
            >
              Show all
            </button>
          ) : null}
        </div>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:overflow-hidden lg:p-3">
        <div className="grid min-h-0 grid-cols-1 gap-3 sm:gap-4 lg:h-full lg:grid-cols-12">
          <section
            className="order-2 min-h-0 min-w-0 lg:order-1 lg:col-span-7 lg:overflow-y-auto"
            aria-label="Upcoming macro events"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-mono text-[9px] uppercase tracking-wider text-neutral-600">
                {selectedDate
                  ? `${formatKlDate(selectedDate)} · ${visible.length} ${visible.length === 1 ? "print" : "prints"}`
                  : `Upcoming · ${visible.length} prints`}
              </p>
            </div>

            {visible.length === 0 ? (
              <p className="border border-neutral-800 bg-[#0d0d0d] px-3 py-6 text-center font-mono text-[10px] uppercase tracking-wider text-neutral-600">
                No events on this date
              </p>
            ) : (
              <ul className="divide-y divide-neutral-800 border border-neutral-800 bg-[#0d0d0d]">
                {visible.map((event) => (
                  <li key={event.id} className="min-w-0 px-2.5 py-2 sm:px-3">
                    <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] leading-snug break-words text-neutral-200">
                          {event.title}
                        </p>
                        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-neutral-600">
                          {event.source} · {formatKlDate(eventCalendarDate(event))}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 sm:flex-col sm:items-end">
                        {event.myt ? (
                          <span className={MYT_TIME_BADGE_CLASS} title={event.myt.label}>
                            {event.myt.badge}
                          </span>
                        ) : null}
                        <span
                          className={`rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                            event.kind === "cpi"
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                              : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                          }`}
                        >
                          {event.badge}
                        </span>
                      </div>
                    </div>
                    <Eli5Block
                      build={() =>
                        summariseMacroEvent({
                          title: event.title,
                          source: event.source,
                          when: event.myt
                            ? `${formatKlDate(event.myt.mytDate)} · ${event.myt.badge} · ${event.badge}`
                            : `${formatKlDate(event.date)} · ${event.badge}`,
                        })
                      }
                      subject={event.title}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="order-1 min-h-0 min-w-0 overflow-x-hidden lg:order-2 lg:col-span-5 lg:h-full lg:overflow-hidden">
            <GlobalMacroCalendarWidget
              events={catalog}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onShowAll={() => setSelectedDate(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
