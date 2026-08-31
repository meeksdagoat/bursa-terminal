"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CommandPalette } from "@/components/command-palette";
import { deskHref } from "@/lib/categories";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function KeyboardLayer() {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }

      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !isTypingTarget(event.target)) {
        event.preventDefault();
        const search =
          (["ticker-search", "ticker-search-mobile"]
            .map((id) => document.getElementById(id))
            .find((el) => el instanceof HTMLInputElement && el.offsetParent !== null) as
            | HTMLInputElement
            | undefined) ?? null;
        if (search) {
          search.focus();
          search.select();
        } else {
          setPaletteOpen(true);
        }
        return;
      }

      if (!event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;

      if (event.code === "Digit1" || event.key === "1") {
        event.preventDefault();
        router.push("/terminal");
      } else if (event.code === "Digit2" || event.key === "2") {
        event.preventDefault();
        router.push("/portfolio");
      } else if (event.code === "Digit3" || event.key === "3") {
        event.preventDefault();
        router.push(deskHref("my-economy"));
      } else if (event.code === "Digit4" || event.key === "4") {
        event.preventDefault();
        router.push(deskHref("my-politics"));
      } else if (event.code === "Digit5" || event.key === "5") {
        event.preventDefault();
        router.push("/calculators");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null;
}
