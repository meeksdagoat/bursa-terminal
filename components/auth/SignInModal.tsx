"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { signIn } from "next-auth/react";

type SignInModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SignInModal({ open, onClose }: SignInModalProps) {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

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
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!ready || !open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md transition-opacity duration-200 ease-out ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signin-modal-title"
        className={`relative w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl transition-all duration-200 ease-out ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close sign in"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-800"
        >
          <span aria-hidden className="text-lg leading-none">
            ×
          </span>
        </button>

        <h2 id="signin-modal-title" className="pr-8 text-lg font-bold tracking-tight">
          Sign in to Bursa Terminal
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Access your portfolio, watchlists, and quant tools.
        </p>

        <button
          type="button"
          onClick={() => {
            void signIn("google");
          }}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50"
        >
          <GoogleMark />
          Sign in with Google
        </button>
      </div>
    </div>,
    document.body,
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.07-1.67-.21-2.45H12v4.64h6.46c-.28 1.5-1.12 2.77-2.39 3.62v3.01h3.87c2.26-2.08 3.58-5.15 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3.01c-1.08.72-2.46 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.26v3.1C3.24 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.25 14.26A7.2 7.2 0 0 1 4.87 12c0-.79.14-1.55.38-2.26V6.64H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.36l3.99-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.14 15.23 0 12 0 7.31 0 3.24 2.7 1.26 6.64l3.99 3.1C6.2 6.87 8.86 4.75 12 4.75Z"
      />
    </svg>
  );
}
