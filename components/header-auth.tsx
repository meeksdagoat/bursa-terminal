"use client";

import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { SignInModal } from "@/components/auth/SignInModal";

export function HeaderAuth({ size = "compact" }: { size?: "compact" | "header" }) {
  const { data: session, status } = useSession();
  const [modalOpen, setModalOpen] = useState(false);
  const user = session?.user;
  const headerSize = size === "header";

  useEffect(() => {
    if (status === "authenticated") setModalOpen(false);
  }, [status]);

  if (status === "authenticated" && user) {
    return <UserMenu name={user.name} image={user.image} size={size} />;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className={
          headerSize
            ? "inline-flex h-9 w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3.5 font-mono text-[12px] font-semibold text-zinc-200 transition-all hover:border-zinc-500 hover:bg-zinc-800"
            : "rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-xs font-semibold text-zinc-200 transition-all hover:border-zinc-500 hover:bg-zinc-800"
        }
      >
        SIGN IN
      </button>
      <SignInModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}

function UserMenu({
  name,
  image,
  size = "compact",
}: {
  name?: string | null;
  image?: string | null;
  size?: "compact" | "header";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = name?.trim() || "Account";

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex flex-shrink-0 items-center">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={
          size === "header"
            ? "flex h-9 w-full items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-3.5 font-mono text-[12px] font-semibold text-zinc-200 transition-all hover:border-zinc-500 hover:bg-zinc-800"
            : "flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs font-semibold text-zinc-200 transition-all hover:border-zinc-500 hover:bg-zinc-800"
        }
      >
        {image ? (
          <img
            src={image}
            alt=""
            width={22}
            height={22}
            referrerPolicy="no-referrer"
            className="h-[22px] w-[22px] rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-zinc-700 text-[10px] text-zinc-200"
          >
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-[10rem] truncate sm:inline">{label}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-1 min-w-[8.5rem] rounded border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex w-full px-3 py-2 text-left font-mono text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            Sign Out
          </button>
        </div>
      ) : null}
    </div>
  );
}
