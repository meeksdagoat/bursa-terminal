"use client";

import { FormEvent, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NICKNAME_MAX, NICKNAME_MIN, isValidNickname } from "@/lib/auth/nickname";

type NicknameModalProps = {
  open: boolean;
  onClose?: () => void;
  onSave: (nickname: string) => void;
  initialValue?: string;
  required?: boolean;
};

export function NicknameModal({
  open,
  onClose,
  onSave,
  initialValue = "",
  required = false,
}: NicknameModalProps) {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  useEffect(() => {
    if (open) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !required) onClose?.();
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, required]);

  const trimmed = value.trim();
  const valid = isValidNickname(value);
  const tooShort = trimmed.length > 0 && trimmed.length < NICKNAME_MIN;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    onSave(trimmed);
  }

  if (!ready || !open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm transition-opacity duration-200 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={required ? undefined : () => onClose?.()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="nickname-modal-title"
        className={`relative w-full max-w-sm rounded-xl border border-line bg-panel p-6 text-neutral-200 shadow-2xl transition-all duration-200 ease-out ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {!required ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close nickname setup"
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-[#161616] hover:text-neutral-200"
          >
            <span aria-hidden className="text-lg leading-none">
              ×
            </span>
          </button>
        ) : null}

        <h2 id="nickname-modal-title" className="pr-8 text-lg font-bold tracking-tight text-white">
          Welcome to Bursa Terminal
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Choose a display nickname to customize your workspace.
        </p>

        <form onSubmit={handleSubmit} className="mt-5">
          <label className="block">
            <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
              Nickname
            </span>
            <input
              autoFocus
              value={value}
              maxLength={NICKNAME_MAX}
              onChange={(event) => setValue(event.target.value)}
              placeholder="e.g. John Doe"
              className="h-10 w-full rounded-md border border-neutral-800 bg-[#0a0a0a] px-3 font-mono text-sm text-neutral-100 outline-none placeholder:text-neutral-600 focus:border-gain/50"
            />
          </label>

          <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[11px]">
            {trimmed.length === 0 || tooShort || !valid ? (
              <p className="text-loss">Must be 4–12 characters</p>
            ) : (
              <p className="text-gain">Looks good</p>
            )}
            <p className={valid ? "text-gain" : "text-neutral-500"}>
              [{trimmed.length}/{NICKNAME_MAX}]
            </p>
          </div>

          <button
            type="submit"
            disabled={!valid}
            className="mt-5 inline-flex h-9 w-full items-center justify-center rounded-md bg-gain px-3.5 font-mono text-[12px] font-semibold text-[#052e16] transition-colors hover:bg-[#4ade80] disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
          >
            Save Nickname
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
