"use client";

import { useMemo, useState } from "react";
import { GlobalMacroCalendarWidget } from "@/components/GlobalMacroCalendarWidget";
import { Eli5Block } from "@/components/eli5-summary";
import { summariseMacroEvent } from "@/lib/eli5";
import { formatKlDate } from "@/lib/format";
import { allGlobalMacroEvents, klTodayIso } from "@/lib/global-calendar";

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
      return catalog.filter((event) => event.date === selectedDate);
    }
    return catalog.filter((event) => event.date >= today);
  }, [catalog, selectedDate, today]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-panel">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-3 py-2">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">
            Global Event Calendar
          </h2>
          <p className="mt-0.5 text-[11px] text-neutral-500">FOMC · US CPI · ECB · BOJ · PBOC LPR</p>
        </div>
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

      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3 lg:overflow-hidden">
        <div className="grid grid-cols-1 gap-4 lg:h-full lg:grid-cols-12">
          <section
            className="order-2 min-h-0 lg:order-1 lg:col-span-7 lg:overflow-y-auto"
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
                  <li key={event.id} className="px-2.5 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] text-neutral-200">{event.title}</p>
                        <p className="font-mono text-[9px] uppercase tracking-wider text-neutral-600">
                          {event.source} · {formatKlDate(event.date)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${
                          event.kind === "cpi"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                        }`}
                      >
                        {event.badge}
                      </span>
                    </div>
                    <Eli5Block
                      build={() =>
                        summariseMacroEvent({
                          title: event.title,
                          source: event.source,
                          when: `${formatKlDate(event.date)} · ${event.badge}`,
                        })
                      }
                      subject={event.title}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="order-1 min-h-[22rem] lg:order-2 lg:col-span-5 lg:min-h-0">
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
