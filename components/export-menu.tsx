"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type ExportAction = {
  id: string;
  label: string;
  onSelect: () => void | Promise<void>;
};

type ExportMenuProps = {
  actions: ExportAction[];
  disabled?: boolean;
};

export function ExportMenu({ actions, disabled }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative no-print">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 items-center gap-1.5 border border-line bg-[#1a1a1a] px-2.5 font-mono text-[10px] uppercase tracking-wider text-neutral-300 hover:border-gain/40 hover:text-gain disabled:opacity-40 md:min-h-0 md:h-7"
      >
        Export Report
        <span aria-hidden className="text-[8px] text-neutral-500">
          ▾
        </span>
      </button>
      {open ? (
        <ul className="absolute right-0 z-40 mt-1 min-w-[220px] border border-line bg-[#0e0e0e] py-1 shadow-xl">
          {actions.map((action) => (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  void action.onSelect();
                }}
                className="flex min-h-11 w-full items-center px-3 text-left font-mono text-[11px] text-neutral-300 hover:bg-[#161616] hover:text-gain md:min-h-9"
              >
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function ExportSlot({ children }: { children: ReactNode }) {
  return <div className="no-print">{children}</div>;
}
