"use client";

import { useState, type ReactNode } from "react";
import { Panel, PanelGroup } from "react-resizable-panels";
import { PanelSplitter } from "@/components/panel-resize-handle";
import { useBreakpoint } from "@/lib/use-media-query";

export type SplitPane = {
  id: string;
  label: string;
  content: ReactNode;
  defaultSize?: number;
  minSize?: number;
};

type ResponsiveSplitProps = {
  autoSaveId: string;
  left: SplitPane;
  right: SplitPane;
};

/**
 * Desktop (≥1024): resizable PanelGroup.
 * Tablet (768–1023): two-column grid.
 * Mobile (<768): one pane at a time, switched with 44px tabs.
 */
export function ResponsiveSplit({ autoSaveId, left, right }: ResponsiveSplitProps) {
  const breakpoint = useBreakpoint();
  const [tab, setTab] = useState(left.id);

  if (breakpoint === "desktop") {
    return (
      <PanelGroup autoSaveId={autoSaveId} direction="horizontal" className="min-h-0 flex-1">
        <Panel
          id={left.id}
          defaultSize={left.defaultSize ?? 50}
          minSize={left.minSize ?? 25}
          className="min-h-0"
        >
          {left.content}
        </Panel>
        <PanelSplitter />
        <Panel
          id={right.id}
          defaultSize={right.defaultSize ?? 50}
          minSize={right.minSize ?? 25}
          className="min-h-0"
        >
          {right.content}
        </Panel>
      </PanelGroup>
    );
  }

  if (breakpoint === "tablet") {
    return (
      <div className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden">
        <div className="min-h-0 min-w-0 overflow-hidden">{left.content}</div>
        <div className="min-h-0 min-w-0 overflow-hidden border-l border-line">{right.content}</div>
      </div>
    );
  }

  const panes = [left, right];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 border-b border-line bg-panel">
        {panes.map((pane) => {
          const active = tab === pane.id;
          return (
            <button
              key={pane.id}
              type="button"
              onClick={() => setTab(pane.id)}
              aria-pressed={active}
              className={`min-h-11 flex-1 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                active ? "bg-[#1a1a1a] text-amber-400" : "text-neutral-500"
              }`}
            >
              {pane.label}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === left.id ? left.content : right.content}
      </div>
    </div>
  );
}
