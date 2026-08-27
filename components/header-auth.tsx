"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export function clerkConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
}

/** Google-only modal sign-in when Clerk keys are present; hidden otherwise. */
export function HeaderAuth() {
  if (!clerkConfigured()) return null;

  return (
    <div className="flex flex-shrink-0 items-center">
      <SignedOut>
        <SignInButton mode="modal" appearance={dark} oauthFlow="popup">
          <button
            type="button"
            className="inline-flex min-h-11 flex-shrink-0 items-center whitespace-nowrap rounded-sm border border-neutral-800 px-2 font-mono text-[9px] uppercase tracking-wider text-neutral-300 hover:border-gain/40 hover:text-gain md:min-h-0 md:px-2.5"
          >
            <span className="hidden sm:inline">Sign in</span>
            <span className="sm:hidden">In</span>
          </button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton
          appearance={{
            theme: dark,
            elements: {
              avatarBox: "h-8 w-8",
            },
          }}
        />
      </SignedIn>
    </div>
  );
}
