"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode, type UIEvent } from "react";

type VirtualListProps = {
  count: number;
  itemHeight: number;
  overscan?: number;
  className?: string;
  renderItem: (index: number) => ReactNode;
};

/**
 * Windowed list for uniform-height rows. Caps DOM nodes on large pickers
 * without adding a virtualization dependency.
 */
export function VirtualList({
  count,
  itemHeight,
  overscan = 8,
  className = "",
  renderItem,
}: VirtualListProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [start, setStart] = useState(0);
  const [viewport, setViewport] = useState(400);

  useLayoutEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    const measure = () => setViewport(node.clientHeight || 400);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const onScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const next = Math.max(0, Math.floor(event.currentTarget.scrollTop / itemHeight) - overscan);
      setStart((current) => (current === next ? current : next));
    },
    [itemHeight, overscan],
  );

  const visibleCount = Math.ceil(viewport / itemHeight) + overscan * 2;
  const end = Math.min(count, start + visibleCount);
  const offset = start * itemHeight;

  return (
    <div ref={scrollerRef} onScroll={onScroll} className={className}>
      <div style={{ height: count * itemHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offset}px)` }}>
          {Array.from({ length: Math.max(0, end - start) }, (_, index) => renderItem(start + index))}
        </div>
      </div>
    </div>
  );
}
