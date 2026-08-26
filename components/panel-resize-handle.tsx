"use client";

import { PanelResizeHandle } from "react-resizable-panels";

type PanelSplitterProps = {
  /** Horizontal splits columns; vertical splits stacked panes. */
  direction?: "horizontal" | "vertical";
  className?: string;
};

/**
 * Amber hover gutter between panes. The library already sets a resize cursor
 * while dragging; the Tailwind classes cover the idle and hover states.
 */
export function PanelSplitter({ direction = "horizontal", className }: PanelSplitterProps) {
  const vertical = direction === "vertical";

  return (
    <PanelResizeHandle
      aria-label={vertical ? "Resize chart and tables" : "Resize columns"}
      className={
        className ??
        (vertical
          ? "h-2 shrink-0 cursor-row-resize bg-line transition-colors hover:bg-amber-500/50 data-[resize-handle-state=hover]:bg-amber-500/50 data-[resize-handle-state=drag]:bg-amber-500/70"
          : "w-3 shrink-0 cursor-col-resize bg-line transition-colors hover:bg-amber-500/50 data-[resize-handle-state=hover]:bg-amber-500/50 data-[resize-handle-state=drag]:bg-amber-500/70 md:w-1.5")
      }
    />
  );
}
