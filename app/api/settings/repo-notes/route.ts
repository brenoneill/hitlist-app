import { requireUserId } from "@/auth";
import {
  getAgentAccessNotes,
  setAgentAccessNotes,
} from "@/app/lib/userSettings";

export async function GET(req: Request) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const repo = new URL(req.url).searchParams.get("repo");
  if (!repo) {
    return Response.json({ error: "repo query param required" }, { status: 400 });
  }
  return Response.json({ notes: (await getAgentAccessNotes(userId, repo)) ?? "" });
}

/** Saves the notes; empty/whitespace clears them. */
export async function PUT(req: Request) {
  const userId = await requireUserId();
  if (userId instanceof Response) return userId;
  const { repoUrl, notes } = (await req.json().catch(() => ({}))) as {
    repoUrl?: string;
    notes?: string;
  };
  if (typeof repoUrl !== "string" || !repoUrl.trim() || typeof notes !== "string") {
    return Response.json(
      { error: "repoUrl and notes (string) required" },
      { status: 400 },
    );
  }
  await setAgentAccessNotes(userId, repoUrl.trim(), notes);
  return Response.json({ notes: notes.trim() });
}
