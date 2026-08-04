import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { headers } from "next/headers";
import { track } from "@vercel/analytics/server";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

/** The signed-in user's id, or the 401 Response to return. */
export async function requireUserId(): Promise<string | Response> {
  const session = await auth();
  return (
    session?.user?.id ??
    Response.json({ error: "sign in required" }, { status: 401 })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // default scope (read:user user:email) — identity only, no repo access.
  // Repo access goes through a separate GitHub App install (see app/lib/githubApp.ts
  // for its actual permissions) — this login itself can't read any code.
  providers: [
    GitHub,
    // Sandbox sign-in for agent/E2E runs (npm run dev:e2e) — GitHub OAuth can't
    // complete in a sandbox (callback URL points at prod). Only registered when
    // AUTH_E2E=1, which is never set in real deployments.
    ...(process.env.AUTH_E2E === "1"
      ? [
          Credentials({
            id: "e2e",
            name: "E2E test user",
            credentials: {},
            // id must match the seed data in app/lib/db.ts
            authorize: async () => ({ id: "e2e-user", name: "E2E Tester" }),
          }),
        ]
      : []),
  ],
  events: {
    // Closes the landing funnel: cta clicks vs. sign-ins that actually
    // completed. Fires once per sign-in, so no dedupe guard needed.
    // ponytail: no isNewUser — that needs a DB adapter, and this is
    // JWT-only. Add one if new-vs-returning ever matters.
    async signIn({ account }) {
      try {
        await track(
          "signed_in",
          { provider: account?.provider ?? "unknown" },
          { headers: await headers() },
        );
      } catch {
        // A dropped metric is not worth a failed sign-in.
      }
    },
  },
  callbacks: {
    // Auth.js mints a fresh random uuid per sign-in (no adapter), so every
    // browser/device would otherwise be a different user. Pin sub to the
    // GitHub account id — stable across sign-ins and devices.
    async jwt({ token, account }) {
      if (account) token.sub = account.providerAccountId;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.sub!;
      return session;
    },
  },
});
