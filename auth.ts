import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";

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
  // Repo listing goes through a separate GitHub App install (see app/lib/githubApp.ts)
  // scoped to Metadata: Read-only, so this login can't read any code.
  providers: [GitHub],
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
