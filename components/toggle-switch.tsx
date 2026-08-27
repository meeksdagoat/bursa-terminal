type ToggleSwitchProps = {
  checked: boolean;
};

/** Tailwind-sized switch track so the white knob never bleeds past the pill. */
export function ToggleSwitch({ checked }: ToggleSwitchProps) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer overflow-hidden rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
        checked ? "bg-emerald-600" : "bg-neutral-800"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </span>
  );
}
