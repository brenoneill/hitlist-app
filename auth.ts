import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // default scope (read:user user:email) — identity only, no repo access.
  // Repo listing goes through a separate GitHub App install (see app/lib/githubApp.ts)
  // scoped to Metadata: Read-only, so this login can't read any code.
  providers: [GitHub],
  callbacks: {
    async session({ session, token }) {
      if (session.user) session.user.id = token.sub!;
      return session;
    },
  },
});
