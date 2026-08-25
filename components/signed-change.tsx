import { changeArrow, changeClass, formatPct } from "@/lib/format";

type SignedPctProps = {
  value: number | null | undefined;
  className?: string;
};

/** Percentage with a directional arrow so P&L is not color-only. */
export function SignedPct({ value, className = "" }: SignedPctProps) {
  const arrow = changeArrow(value);

  return (
    <span className={`inline-flex items-center gap-0.5 tabular-nums ${changeClass(value)} ${className}`}>
      {arrow ? (
        <span aria-hidden className="select-none text-[0.72em] leading-none">
          {arrow}
        </span>
      ) : null}
      <span>{formatPct(value)}</span>
    </span>
  );
}
