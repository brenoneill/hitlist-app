import { AppHeader } from "@/app/components/AppHeader";
import { Button } from "@/app/components/Button";
import { Icon, type IconName } from "@/app/components/Icons";
import { FieldLabel } from "@/app/components/ui/FieldLabel";

const WHAT: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "external",
    title: "A live URL per PR branch",
    body: "Your host (Vercel, Netlify, Render, Cloudflare Pages, …) builds the branch and publishes a temporary URL. That URL is the preview — the app as it runs on that PR, not production.",
  },
  {
    icon: "pr",
    title: "Reported through GitHub Deployments",
    body: "Those hosts post the URL to GitHub’s Deployments API. HitList reads that (no vendor token) and surfaces Open preview on the PR tab.",
  },
];

const WHY: { title: string; body: string }[] = [
  {
    title: "Review without a checkout",
    body: "Tap through the real UI on your phone — same flow HitList is built for. Screenshots prove the agent did something; the preview lets you feel it.",
  },
  {
    title: "Merge with confidence",
    body: "Visual proof plus a running branch closes the gap between “looks right in a screenshot” and “works when you click around.”",
  },
  {
    title: "Keeps the phone loop closed",
    body: "Dispatch → PR → proof → preview → merge, without opening a laptop or waiting on a local build.",
  },
];

const SETUP: { step: string; body: string }[] = [
  {
    step: "1",
    body: "Connect the repo to a host that deploys every pull-request branch (Vercel, Netlify, Render, or Cloudflare Pages are common).",
  },
  {
    step: "2",
    body: "Push or open a PR — wait until that host’s preview build succeeds. The deployment URL is what HitList needs.",
  },
  {
    step: "3",
    body: "Install the HitList GitHub App on the repo (Settings → GitHub). It needs Deployments: Read so preview URLs can appear here.",
  },
  {
    step: "4",
    body: "Open the hit’s PR tab. When the build is green, Deployments lists the environment and Open preview goes live.",
  },
];

/**
 * Informational page: what preview branches are, why they matter for phone
 * review, and how to wire a host so HitList can show Open preview.
 */
export function PreviewBranchesInfo() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <AppHeader backHref="/app" title="Preview branches" hideSettingsLink />

      <p className="mb-8 text-sm text-muted">
        Preview branches power the Open preview button on each hit. Without them,
        you can still read the PR and visual proof — you just can&apos;t tap into
        a running build of the branch from your phone.
      </p>

      <FieldLabel as="h2" className="mb-3">
        What they are
      </FieldLabel>
      <ul className="mb-8 flex flex-col gap-3">
        {WHAT.map((item) => (
          <li
            key={item.title}
            className="rounded-xl border border-edge bg-surface px-4 py-3"
          >
            <p className="flex items-center gap-2 text-sm font-medium">
              <Icon name={item.icon} className="size-4 shrink-0 text-blood" />
              {item.title}
            </p>
            <p className="mt-1.5 text-sm text-muted">{item.body}</p>
          </li>
        ))}
      </ul>

      <FieldLabel as="h2" className="mb-3">
        Why they help here
      </FieldLabel>
      <ul className="mb-8 flex flex-col gap-4">
        {WHY.map((item) => (
          <li key={item.title}>
            <p className="text-sm font-medium">{item.title}</p>
            <p className="mt-1 text-sm text-muted">{item.body}</p>
          </li>
        ))}
      </ul>

      <FieldLabel as="h2" className="mb-3">
        How to get set up
      </FieldLabel>
      <ol className="mb-8 flex flex-col gap-3">
        {SETUP.map((item) => (
          <li
            key={item.step}
            className="flex gap-3 rounded-xl border border-edge bg-surface px-4 py-3"
          >
            <span
              aria-hidden
              className="flex size-6 shrink-0 items-center justify-center rounded-lg border border-edge font-mono text-[11px] text-muted"
            >
              {item.step}
            </span>
            <p className="min-w-0 text-sm text-muted">{item.body}</p>
          </li>
        ))}
      </ol>

      <p className="mb-4 font-mono text-xs text-muted">
        Still empty after a green build? Confirm the host posts to GitHub
        Deployments and that the HitList app is installed on that repo.
      </p>

      <Button href="/app/settings" variant="outline" className="w-full text-center">
        Open Settings
      </Button>
    </main>
  );
}
