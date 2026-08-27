"use client";

type ExportCsvButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
};

export function ExportCsvButton({
  onClick,
  disabled,
  label = "Export CSV",
}: ExportCsvButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-11 flex-shrink-0 items-center gap-1 whitespace-nowrap border border-line bg-[#1a1a1a] px-2 font-mono text-[10px] uppercase tracking-wider text-neutral-300 hover:border-gain/40 hover:text-gain disabled:opacity-40 md:min-h-0 md:h-7"
    >
      <span aria-hidden>📥</span>
      {label}
    </button>
  );
}
