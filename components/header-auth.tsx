"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { signOut, useSession } from "next-auth/react";
import { NicknameModal } from "@/components/auth/NicknameModal";
import { SignInModal } from "@/components/auth/SignInModal";
import { isValidNickname, readStoredNickname, writeStoredNickname } from "@/lib/auth/nickname";

export function HeaderAuth({ size = "compact" }: { size?: "compact" | "header" }) {
  const { data: session, status, update } = useSession();
  const [signInOpen, setSignInOpen] = useState(false);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [localNickname, setLocalNickname] = useState<string | null>(null);
  const user = session?.user;
  const headerSize = size === "header";
  const sessionNickname = user?.nickname && isValidNickname(user.nickname) ? user.nickname.trim() : null;
  const nickname = sessionNickname ?? localNickname;

  useEffect(() => {
    if (status === "authenticated") setSignInOpen(false);
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || !user) {
      setLocalNickname(null);
      setNicknameOpen(false);
      return;
    }

    const stored = readStoredNickname(user.email);
    if (stored) {
      setLocalNickname(stored);
      if (!sessionNickname) void update({ nickname: stored });
      setNicknameOpen(false);
      return;
    }

    if (!sessionNickname) setNicknameOpen(true);
  }, [status, user?.email, sessionNickname, update]);

  async function handleSaveNickname(next: string) {
    writeStoredNickname(next, user?.email);
    setLocalNickname(next);
    await update({ nickname: next });
    setNicknameOpen(false);
  }

  if (status === "authenticated" && user) {
    return (
      <>
        <UserMenu
          nickname={nickname}
          image={user.image}
          size={size}
          onRequestNickname={() => setNicknameOpen(true)}
        />
        <NicknameModal
          open={nicknameOpen}
          required={!nickname}
          initialValue={nickname ?? ""}
          onClose={() => {
            if (nickname) setNicknameOpen(false);
          }}
          onSave={handleSaveNickname}
        />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setSignInOpen(true)}
        className={
          headerSize
            ? "inline-flex h-9 w-full items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 px-3.5 font-mono text-[12px] font-semibold text-zinc-200 transition-all hover:border-zinc-500 hover:bg-zinc-800"
            : "inline-flex h-7 items-center rounded border border-zinc-700 bg-zinc-900 px-1.5 font-mono text-[10px] font-semibold leading-none whitespace-nowrap text-zinc-200 transition-all hover:border-zinc-500 hover:bg-zinc-800 md:h-auto md:px-3 md:py-1.5 md:text-xs"
        }
      >
        SIGN IN
      </button>
      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </>
  );
}

function UserMenu({
  nickname,
  image,
  size = "compact",
  onRequestNickname,
}: {
  nickname: string | null;
  image?: string | null;
  size?: "compact" | "header";
  onRequestNickname: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const initial = (nickname ?? "?").trim().slice(0, 1).toUpperCase();

  useEffect(() => {
    setReady(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 8,
      right: Math.max(8, window.innerWidth - rect.right),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        const menu = document.getElementById("header-user-menu");
        if (menu?.contains(event.target as Node)) return;
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onReposition() {
      if (!rootRef.current) return;
      const rect = rootRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  function handleProfileClick() {
    if (!nickname) {
      onRequestNickname();
      return;
    }
    setOpen((current) => !current);
  }

  return (
    <div ref={rootRef} className="relative inline-block flex-shrink-0">
      <button
        type="button"
        aria-haspopup={nickname ? "menu" : undefined}
        aria-expanded={nickname ? open : undefined}
        onClick={handleProfileClick}
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
            {initial}
          </span>
        )}
        {nickname ? <span className="hidden max-w-[7.5rem] truncate sm:inline">{nickname}</span> : null}
      </button>

      {ready && open && nickname
        ? createPortal(
            <div
              id="header-user-menu"
              role="menu"
              style={{ top: menuPos.top, right: menuPos.right }}
              className="fixed z-[100] w-48 rounded-lg border border-neutral-800 bg-[#0d0d0d] p-2 py-1 shadow-2xl"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onRequestNickname();
                }}
                className="flex w-full rounded-md px-3 py-2 text-left font-mono text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Edit nickname
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
                className="flex w-full rounded-md px-3 py-2 text-left font-mono text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-800"
              >
                Sign Out
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
