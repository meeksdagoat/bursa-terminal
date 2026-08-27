import type { HTMLAttributes, ReactNode } from "react";

type HScrollProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  className?: string;
  /** Snap each child to the start of the scroller — used for ticker chips. */
  snap?: boolean;
  "aria-label"?: string;
};

/** Horizontal swipe strip with hidden scrollbars for mobile ticker / macro rows. */
export function HScroll({
  children,
  className = "",
  snap = false,
  "aria-label": ariaLabel,
  ...rest
}: HScrollProps) {
  return (
    <div
      aria-label={ariaLabel}
      className={`flex flex-nowrap items-center overflow-x-auto overflow-y-clip overscroll-none whitespace-nowrap scrollbar-none touch-pan-x ${
        snap ? "snap-x snap-mandatory" : ""
      } ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function ShowMoreBar({
  remaining,
  onClick,
  label = "more",
}: {
  remaining: number;
  onClick: () => void;
  label?: string;
}) {
  if (remaining <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center justify-center border-t border-line font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500 hover:bg-[#161616] hover:text-gain"
    >
      Show {remaining} {label}
    </button>
  );
}

export const tableHeadClass =
  "sticky top-0 z-10 whitespace-nowrap border-b border-line bg-slate-900 px-1.5 py-1 text-xs font-semibold md:px-2 md:py-1.5 md:text-sm";
export const stickyHeadClass = `${tableHeadClass} left-0 z-20`;
export const stickyCellClass =
  "sticky left-0 z-10 whitespace-nowrap bg-slate-900 px-1.5 py-1 text-xs md:px-2 md:py-1.5 md:text-sm";
export const tableCellClass =
  "px-1.5 py-1 text-xs tabular-nums md:px-2 md:py-1.5 md:text-sm";
