import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import type { ReactNode } from "react";

export function AppClerkProvider({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) return children;

  return (
    <ClerkProvider publishableKey={publishableKey} appearance={dark}>
      {children}
    </ClerkProvider>
  );
}
