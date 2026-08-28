"use client";

import { useEffect, useState } from "react";

const LEGEND_SESSION_KEY = "geopolitics:legend-open";

export function MapLegend() {
  return (
    <div className="rounded border border-neutral-800 bg-[#121212]/95 px-3 py-2 backdrop-blur-sm">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-neutral-500">Activity scale</p>
      <ul className="mt-2 space-y-1.5">
        <LegendRow color="#1a1a1a" label="Quiet / no wire" />
        <LegendRow color="#78350f" label="Low density" />
        <LegendRow color="#d97706" label="Elevated" />
        <LegendRow color="#ea580c" label="High activity" />
        <LegendRow color="#ef4444" label="Conflict / crisis" />
      </ul>
      <div className="mt-3 border-t border-neutral-800 pt-2 font-mono text-[9px] text-neutral-600">
        ⚔️ Conflict · 🌪️ Disaster · ⚖️ Elections / sanctions
      </div>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-sm border border-neutral-800" style={{ backgroundColor: color }} />
      <span className="font-mono text-[9px] text-neutral-400">{label}</span>
    </li>
  );
}

export function MapLegendPanel() {
  const [isLegendOpen, setIsLegendOpen] = useState(true);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(LEGEND_SESSION_KEY);
      if (stored === "0") setIsLegendOpen(false);
    } catch {
      /* sessionStorage unavailable */
    }
  }, []);

  function toggleLegend() {
    setIsLegendOpen((current) => {
      const next = !current;
      try {
        sessionStorage.setItem(LEGEND_SESSION_KEY, next ? "1" : "0");
      } catch {
        /* sessionStorage unavailable */
      }
      return next;
    });
  }

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-20">
      {isLegendOpen ? (
        <div className="pointer-events-auto max-w-[200px]">
          <div className="rounded border border-neutral-800 bg-[#141414]/90 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2 border-b border-neutral-800 px-2.5 py-1.5">
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-neutral-500">
                Activity scale
              </span>
              <button
                type="button"
                onClick={toggleLegend}
                aria-expanded
                aria-label="Hide activity scale legend"
                className="shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] text-neutral-500 transition-colors hover:text-amber-400"
              >
                Hide
              </button>
            </div>
            <div className="px-3 py-2">
              <ul className="space-y-1.5">
                <LegendRow color="#1a1a1a" label="Quiet / no wire" />
                <LegendRow color="#78350f" label="Low density" />
                <LegendRow color="#d97706" label="Elevated" />
                <LegendRow color="#ea580c" label="High activity" />
                <LegendRow color="#ef4444" label="Conflict / crisis" />
              </ul>
              <div className="mt-2 border-t border-neutral-800 pt-2 font-mono text-[9px] text-neutral-600">
                ⚔️ Conflict · 🌪️ Disaster · ⚖️ Elections
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={toggleLegend}
          aria-expanded={false}
          aria-label="Show activity scale legend"
          className="pointer-events-auto rounded border border-neutral-800 bg-[#141414]/90 px-2.5 py-1 font-mono text-xs text-neutral-400 backdrop-blur-sm transition-all hover:text-amber-400"
        >
          Show Legend
        </button>
      )}
    </div>
  );
}
