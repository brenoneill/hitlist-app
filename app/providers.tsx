"use client";

import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children }: { children: React.ReactNode }) {
  // one client per browser session, created lazily so SSR never shares it
  const [client] = useState(
    () =>
      new QueryClient({
        // signed out is a 401 on every endpoint — don't retry that three times
        defaultOptions: { queries: { retry: 1 } },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
