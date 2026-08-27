"use client";

type ExportCsvButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
};

export function ExportCsvButton({
  onClick,
  disabled,
  label = "Export",
}: ExportCsvButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex h-11 min-h-11 w-11 flex-shrink-0 items-center justify-center gap-1 whitespace-nowrap border border-line bg-[#1a1a1a] px-0 font-mono text-[10px] uppercase tracking-wider text-neutral-300 hover:border-gain/40 hover:text-gain disabled:opacity-40 sm:h-7 sm:min-h-0 sm:w-auto sm:px-2 md:h-7"
    >
      <span aria-hidden>📥</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
