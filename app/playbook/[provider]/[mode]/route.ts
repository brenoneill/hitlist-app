import { readFile } from "node:fs/promises";
import path from "node:path";
import { PROVIDER_IDS, type ProviderId } from "@/app/lib/providerMeta";
import { isVisualConfirmationId } from "@/app/lib/prOptions";

/**
 * Serves the composed playbook for one dispatch: base.md + the selected
 * visual skill, concatenated server-side. Agents fetch this single URL from
 * the kickoff prompt (see `playbookBootstrap`); nothing is written into the
 * target repo. Always current — no versioning needed.
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/playbook/[provider]/[mode]">,
) {
  const { provider, mode } = await ctx.params;
  if (
    !PROVIDER_IDS.includes(provider as ProviderId) ||
    !isVisualConfirmationId(mode)
  ) {
    return new Response("unknown playbook", { status: 404 });
  }
  const dir = path.join(process.cwd(), "public", "playbook");
  const [base, skill] = await Promise.all([
    readFile(path.join(dir, "base.md"), "utf8"),
    readFile(path.join(dir, "skills", `visual-${provider}-${mode}.md`), "utf8"),
  ]);
  return new Response(`${base}\n${skill}`, {
    headers: { "content-type": "text/markdown; charset=utf-8" },
  });
}
