type ToggleSwitchProps = {
  checked: boolean;
  compact?: boolean;
};

/** Tailwind-sized switch track so the white knob never bleeds past the pill. */
export function ToggleSwitch({ checked, compact = false }: ToggleSwitchProps) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex flex-shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
        compact ? "h-4 w-7" : "h-6 w-11"
      } ${checked ? "bg-emerald-600" : "bg-neutral-800"}`}
    >
      <span
        className={`pointer-events-none inline-block transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          compact ? "h-3 w-3" : "h-5 w-5"
        } ${checked ? (compact ? "translate-x-3" : "translate-x-5") : "translate-x-0"}`}
      />
    </span>
  );
}
