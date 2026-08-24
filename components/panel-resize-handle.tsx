"use client";

import { PanelResizeHandle } from "react-resizable-panels";

type PanelSplitterProps = {
  /** Horizontal splits columns; vertical splits stacked panes. */
  direction?: "horizontal" | "vertical";
};

/**
 * Amber hover gutter between panes. The library already sets a resize cursor
 * while dragging; the Tailwind classes cover the idle and hover states.
 */
export function PanelSplitter({ direction = "horizontal" }: PanelSplitterProps) {
  const vertical = direction === "vertical";

  return (
    <PanelResizeHandle
      className={
        vertical
          ? "h-3 bg-line transition-colors hover:bg-amber-500/50 data-[resize-handle-state=hover]:bg-amber-500/50 data-[resize-handle-state=drag]:bg-amber-500/70 cursor-row-resize md:h-1.5"
          : "w-3 bg-line transition-colors hover:bg-amber-500/50 data-[resize-handle-state=hover]:bg-amber-500/50 data-[resize-handle-state=drag]:bg-amber-500/70 cursor-col-resize md:w-1.5"
      }
    />
  );
}
