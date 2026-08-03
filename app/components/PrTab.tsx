"use client";

import { useEffect, useRef, useState } from "react";
import type { Deployment, PrFile } from "@/app/lib/githubApp";
import { cleanPrBody, extractImages } from "@/app/lib/markdownish";
import type { Task } from "@/app/lib/tasks";
import { useMarkPrReady, useMergePr, usePrDetails } from "@/app/lib/queries";
import { Button } from "@/app/components/Button";
import { Icon } from "@/app/components/Icons";
import { Sheet } from "@/app/components/Sheets";
import { ErrorText } from "@/app/components/ui/ErrorText";
import { FieldLabel } from "@/app/components/ui/FieldLabel";
import { Markdownish } from "@/app/components/ui/Markdownish";
import { OverlayDialog } from "@/app/components/ui/OverlayDialog";
import { Skeleton } from "@/app/components/ui/Skeleton";

/**
 * A GitHub-hosted PR asset needs the viewer's github.com session, which a
 * cross-site <img> load never carries — route those through our installation-token
 * proxy. Everything else (catbox, cursor.com artifacts) loads directly.
 */
export function isGithubHost(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return h === "github.com" || h.endsWith(".githubusercontent.com");
  } catch {
    return false;
  }
}

export const PR_STATE = {
  open: "text-info",
  merged: "text-ok",
  closed: "text-muted",
} as const;

/** The PR tab: visual proof up top, then summary, deployments, files, sticky merge. */
export function PrTab({ task }: { task: Task }) {
  const [confirming, setConfirming] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [openFile, setOpenFile] = useState<PrFile | null>(null);
  const { data: pr, error, isLoading } = usePrDetails(task.id, !!task.prUrl);
  const mergeMutation = useMergePr(task.id);
  const readyMutation = useMarkPrReady(task.id);

  // Summary and previewUrl live on the task, but visual proof needs the PR
  // body — paint nothing until that read lands so sections don't arrive staggered.
  if (task.prUrl && isLoading && !pr) {
    return <PrTabSkeleton />;
  }

  const resolveImageUrl = (url: string) =>
    isGithubHost(url)
      ? `/api/tasks/${task.id}/pr/image?url=${encodeURIComponent(url)}`
      : url;
  const prBody = pr?.body ? cleanPrBody(pr.body) : undefined;
  const images = extractImages(prBody, task.agentSummary);
  const lightboxOpen =
    lightboxIndex != null &&
    lightboxIndex >= 0 &&
    lightboxIndex < images.length;

  return (
    <section className="mb-6">
      {pr && (
        <div className="mb-4 rounded-xl border border-edge bg-surface px-4 py-3">
          <p className="break-words text-sm font-medium">
            {pr.title}{" "}
            <a
              href={task.prUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap font-mono text-xs text-muted underline underline-offset-4"
            >
              #{pr.number} ↗
            </a>
          </p>
          <p className="mt-1 truncate font-mono text-xs text-muted">
            {pr.headRef} → {pr.baseRef}
          </p>
          <p className="mt-1 font-mono text-xs">
            <span
              className={`uppercase tracking-widest ${
                pr.draft
                  ? "text-warn"
                  : (PR_STATE[pr.state as keyof typeof PR_STATE] ?? "text-muted")
              }`}
            >
              {pr.draft ? "draft" : pr.state}
            </span>{" "}
            <span className="text-ok">+{pr.additions}</span>{" "}
            <span className="text-blood">−{pr.deletions}</span>{" "}
            <span className="text-muted">
              · {pr.changedFiles} {pr.changedFiles === 1 ? "file" : "files"}
            </span>
          </p>
        </div>
      )}

      <FieldLabel as="h2" className="mb-2">
        Visual proof
      </FieldLabel>
      {images.length > 0 ? (
        <div className="-mx-4 mb-4 flex snap-x scroll-pl-4 gap-2 overflow-x-auto px-4 pb-1">
          {images.map((img, i) => (
            <ScreenshotThumb
              key={img.url}
              url={img.url}
              src={resolveImageUrl(img.url)}
              alt={img.alt}
              onOpen={() => setLightboxIndex(i)}
            />
          ))}
        </div>
      ) : (
        <p className="mb-4 font-mono text-xs text-muted">
          No screenshots — the agent didn&apos;t post any for this task.
        </p>
      )}

      {task.agentSummary && (
        <>
          <FieldLabel as="h2" className="mb-2">
            Summary
          </FieldLabel>
          <div className="mb-4 rounded-xl border border-edge bg-surface px-4 py-3 text-sm text-muted">
            <Markdownish
              text={task.agentSummary}
              hideImages
              resolveImageUrl={resolveImageUrl}
            />
          </div>
        </>
      )}

      <Deployments task={task} deployments={pr?.deployments} />

      <FieldLabel as="h2" className="mb-2">
        Pull request
      </FieldLabel>

      {!task.prUrl ? (
        <p className="font-mono text-xs text-muted">
          No pull request yet — it appears once the agent pushes.
        </p>
      ) : (
        <>
          {error && (
            <>
              <ErrorText className="mb-2">{error.message}</ErrorText>
              <Button
                href={task.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="outline"
                className="flex w-full items-center justify-center gap-2 active:bg-background"
              >
                View PR on GitHub
                <Icon name="external" className="size-4" />
              </Button>
            </>
          )}
          {pr && (
            <>
              {prBody && (
                <details className="mb-3 overflow-hidden rounded-xl border border-edge bg-surface">
                  <summary className="cursor-pointer px-4 py-3 font-mono text-xs active:bg-background">
                    Description
                  </summary>
                  <Markdownish
                    text={prBody}
                    hideImages
                    resolveImageUrl={resolveImageUrl}
                    className="border-t border-edge px-4 py-3 text-sm text-muted"
                  />
                </details>
              )}

              <div className="mb-3 flex flex-col gap-2">
                {pr.files.map((f) => (
                  <FileRow
                    key={f.filename}
                    file={f}
                    onOpen={() => setOpenFile(f)}
                  />
                ))}
              </div>

              {pr.state === "open" && pr.draft && (
                <div className="sticky bottom-0 z-10 -mx-1 bg-background/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
                  <Button
                    variant="info"
                    onClick={() => readyMutation.mutate()}
                    disabled={readyMutation.isPending}
                    className="flex w-full items-center justify-center gap-2"
                  >
                    <Icon name="check" className="size-4" />
                    {readyMutation.isPending
                      ? "Marking ready…"
                      : "Mark as Ready"}
                  </Button>
                  {readyMutation.error && (
                    <ErrorText className="mt-2">
                      {readyMutation.error.message}
                    </ErrorText>
                  )}
                </div>
              )}
              {pr.state === "open" && !pr.draft && (
                <div className="sticky bottom-0 z-10 -mx-1 bg-background/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
                  <Button
                    variant="ok"
                    onClick={() => setConfirming(true)}
                    disabled={mergeMutation.isPending}
                    className="flex w-full items-center justify-center gap-2"
                  >
                    <Icon name="merge" className="size-4" />
                    {mergeMutation.isPending ? "Merging…" : "Merge"}
                  </Button>
                  {mergeMutation.error && (
                    <ErrorText className="mt-2">
                      {mergeMutation.error.message}
                    </ErrorText>
                  )}
                </div>
              )}
              {pr.state === "merged" && (
                <p className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-ok">
                  <Icon name="merge" className="size-3" />
                  Merged
                </p>
              )}
            </>
          )}
        </>
      )}

      {lightboxOpen && lightboxIndex != null && (
        <ImageViewer
          images={images}
          index={lightboxIndex}
          resolveImageUrl={resolveImageUrl}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {openFile && (
        <Sheet onClose={() => setOpenFile(null)}>
          <DiffSheet file={openFile} />
        </Sheet>
      )}

      {confirming && (
        <OverlayDialog placement="bottom" onClose={() => setConfirming(false)}>
          {({ requestClose }) => (
            <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5">
              <p className="mb-1 text-lg font-medium">Execute the merge?</p>
              <p className="mb-4 font-mono text-xs text-muted">
                Squash-merges {pr ? `#${pr.number}` : "the PR"} into{" "}
                {pr?.baseRef ?? "the base branch"}.
              </p>
              <Button
                variant="ok"
                onClick={() => {
                  mergeMutation.mutate();
                  requestClose();
                }}
                className="mb-2 flex w-full items-center justify-center gap-2"
              >
                <Icon name="merge" className="size-4" />
                Merge
              </Button>
              <Button
                variant="outline"
                onClick={requestClose}
                className="w-full"
              >
                Stand down
              </Button>
            </div>
          )}
        </OverlayDialog>
      )}
    </section>
  );
}

/**
 * Full-size PR screenshot sheet with swipe + arrow navigation and caption.
 * Images live in a snap-scroll strip (same pattern as ActionRow) so each
 * item is natively swipable; arrows / keys scroll that strip into place.
 * @param images - Gallery entries from the PR body / agent summary.
 * @param index - Currently viewed image index.
 * @param resolveImageUrl - Proxy GitHub-hosted assets when needed.
 * @param onIndexChange - Move to another image in the gallery.
 * @param onClose - Dismiss the sheet after exit animation.
 */
function ImageViewer({
  images,
  index,
  resolveImageUrl,
  onIndexChange,
  onClose,
}: {
  images: { url: string; alt: string }[];
  index: number;
  resolveImageUrl: (url: string) => string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const current = images[index];
  const count = images.length;
  const canNavigate = count > 1;
  const scrollerRef = useRef<HTMLDivElement>(null);
  // mouse has no native drag-scroll; touch/pen keep the snap strip
  const mouseDrag = useRef<{
    id: number;
    startX: number;
    startScroll: number;
    startIndex: number;
  } | null>(null);

  function scrollToIndex(next: number, behavior: ScrollBehavior) {
    const el = scrollerRef.current;
    const slide = el?.children[next] as HTMLElement | undefined;
    if (!el || !slide) return;
    el.scrollTo({ left: slide.offsetLeft, behavior });
  }

  function go(delta: number) {
    if (!canNavigate) return;
    const next = (index + delta + count) % count;
    // wrapping jumps across the strip — skip the long smooth pan
    const wrapping =
      (index === 0 && next === count - 1) ||
      (index === count - 1 && next === 0);
    onIndexChange(next);
    scrollToIndex(next, wrapping ? "auto" : "smooth");
  }

  // land on the opened thumb without animating past neighbors
  useEffect(() => {
    scrollToIndex(index, "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  useEffect(() => {
    if (!canNavigate) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const next = (index - 1 + count) % count;
        const wrapping = index === 0;
        onIndexChange(next);
        scrollToIndex(next, wrapping ? "auto" : "smooth");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = (index + 1) % count;
        const wrapping = index === count - 1;
        onIndexChange(next);
        scrollToIndex(next, wrapping ? "auto" : "smooth");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canNavigate, count, index, onIndexChange]);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el || !canNavigate) return;
    const width = el.clientWidth;
    if (width <= 0) return;
    const next = Math.round(el.scrollLeft / width);
    if (next !== index && next >= 0 && next < count) onIndexChange(next);
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!canNavigate || e.pointerType !== "mouse") return;
    const el = scrollerRef.current;
    if (!el) return;
    mouseDrag.current = {
      id: e.pointerId,
      startX: e.clientX,
      startScroll: el.scrollLeft,
      startIndex: index,
    };
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = mouseDrag.current;
    if (!drag || drag.id !== e.pointerId) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft = drag.startScroll - (e.clientX - drag.startX);
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const drag = mouseDrag.current;
    if (!drag || drag.id !== e.pointerId) return;
    mouseDrag.current = null;
    const dx = e.clientX - drag.startX;
    // commit on a short swipe; otherwise snap back to the start slide
    let next = drag.startIndex;
    if (dx <= -60) next = Math.min(count - 1, drag.startIndex + 1);
    else if (dx >= 60) next = Math.max(0, drag.startIndex - 1);
    onIndexChange(next);
    scrollToIndex(next, "smooth");
  }

  if (!current) return null;

  return (
    <Sheet onClose={onClose}>
      {canNavigate && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous image"
            className="flex size-10 items-center justify-center rounded-xl border border-edge active:bg-background"
          >
            <Icon name="chevron" className="size-4 rotate-90" />
          </button>
          <p className="font-mono text-xs text-muted" aria-live="polite">
            {index + 1} / {count}
          </p>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next image"
            className="flex size-10 items-center justify-center rounded-xl border border-edge active:bg-background"
          >
            <Icon name="chevron" className="size-4 -rotate-90" />
          </button>
        </div>
      )}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`-mx-5 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          canNavigate ? "cursor-grab active:cursor-grabbing" : ""
        }`}
      >
        {images.map((img) => (
          <div
            key={img.url}
            className="w-full shrink-0 snap-center px-5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- artifact hosts are arbitrary and unknown ahead of time */}
            <img
              src={resolveImageUrl(img.url)}
              alt={img.alt}
              draggable={false}
              // fixed height (not max-h) so the sheet — and the scroll offsets
              // `scrollToIndex` measures — settle before any image decodes
              className="pointer-events-none h-[70dvh] w-full rounded-lg border border-edge bg-edge/40 object-contain"
            />
          </div>
        ))}
      </div>
      <div className="mt-3">
        <FieldLabel as="h2" className="mb-1">
          Caption
        </FieldLabel>
        <p className="font-mono text-xs text-muted">
          {current.alt.trim() || "No caption"}
        </p>
      </div>
      <Button
        href={current.url}
        target="_blank"
        rel="noopener noreferrer"
        variant="outline"
        className="mt-3 flex w-full items-center justify-center gap-2 active:bg-background"
      >
        Open full size
        <Icon name="external" className="size-4" />
      </Button>
    </Sheet>
  );
}

/**
 * Full-tab placeholder while PR details load. Summary / previewUrl are already
 * on the task, so a partial paint used to land those first and then jump when
 * visual proof resolved (often to "no screenshots").
 */
function PrTabSkeleton() {
  return (
    <section className="mb-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading pull request</span>
      <div
        aria-hidden
        className="mb-4 rounded-xl border border-edge bg-surface px-4 py-3"
      >
        <Skeleton className="h-5 w-3/4 rounded bg-edge" />
        <Skeleton className="mt-1 h-4 w-1/2 rounded bg-edge" />
        <Skeleton className="mt-1 h-4 w-2/3 rounded bg-edge" />
      </div>

      <FieldLabel as="h2" className="mb-2">
        Visual proof
      </FieldLabel>
      <div className="-mx-4 mb-4 flex gap-2 px-4 pb-1" aria-hidden>
        <Skeleton className="h-36 aspect-[16/10] rounded-lg border border-edge bg-surface" />
      </div>

      <FieldLabel as="h2" className="mb-2">
        Summary
      </FieldLabel>
      <div
        aria-hidden
        className="mb-4 rounded-xl border border-edge bg-surface px-4 py-3"
      >
        <Skeleton className="h-4 w-full rounded bg-edge" />
        <Skeleton className="mt-2 h-4 w-5/6 rounded bg-edge" />
        <Skeleton className="mt-2 h-4 w-2/3 rounded bg-edge" />
      </div>

      <FieldLabel as="h2" className="mb-2">
        Deployments
      </FieldLabel>
      <Skeleton className="mb-4 h-[86px] rounded-xl border border-edge bg-surface" />

      <FieldLabel as="h2" className="mb-2">
        Pull request
      </FieldLabel>
      <div aria-hidden>
        <Skeleton className="mb-3 h-[42px] rounded-xl border border-edge bg-surface" />
        <div className="mb-3 flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              className="h-[42px] rounded-xl border border-edge bg-surface"
            />
          ))}
        </div>
        <Skeleton className="h-11 rounded-xl bg-edge" />
      </div>
    </section>
  );
}

function ScreenshotThumb({
  url,
  src,
  alt,
  onOpen,
}: {
  url: string;
  src: string;
  alt: string;
  onOpen: () => void;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={alt || "View screenshot"}
      className="shrink-0 snap-start"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- artifact hosts are arbitrary and unknown ahead of time */}
      <img
        src={src}
        alt={alt}
        onError={() => setFailed(true)}
        data-original-url={url}
        // the box has to be known before decode or the thumb starts as a 2px
        // line and shoves its neighbours sideways when the bytes land
        className="h-36 aspect-[16/10] rounded-lg border border-edge bg-edge object-cover"
      />
    </button>
  );
}

/** Deployment state dot: green live, red broken, amber still building. */
function deployDotClass(state: string): string {
  if (state === "success") return "bg-ok";
  if (state === "failure" || state === "error") return "bg-blood";
  if (state === "inactive") return "bg-muted";
  return "bg-warn animate-pulse motion-reduce:animate-none";
}

/**
 * Preview builds for the PR's branch, so a mark can be tested from the phone.
 * Falls back to the `previewUrl` the task poll stores when the PR read has no
 * deployments (no PR yet, or Deployments access not granted).
 */
function Deployments({
  task,
  deployments,
}: {
  task: Task;
  deployments?: Deployment[];
}) {
  const rows = deployments?.length
    ? deployments
    : task.previewUrl
      ? [{ environment: "Preview", state: "success", url: task.previewUrl }]
      : [];

  return (
    <>
      <FieldLabel as="h2" className="mb-2">
        Deployments
      </FieldLabel>
      {rows.length === 0 ? (
        <p className="mb-4 font-mono text-xs text-muted">
          No deployment yet — it appears once a preview build finishes.
        </p>
      ) : (
        <div className="mb-4 flex flex-col gap-2">
          {rows.map((d, i) => (
            <div
              key={`${d.environment}-${i}`}
              className="rounded-xl border border-edge bg-surface px-4 py-3"
            >
              <p className="flex items-center gap-2 font-mono text-xs">
                <span
                  aria-hidden
                  className={`size-2 shrink-0 rounded-full ${deployDotClass(d.state)}`}
                />
                <span className="min-w-0 flex-1 truncate">{d.environment}</span>
                <span className="shrink-0 text-muted">
                  {d.state.replace("_", " ")}
                </span>
              </p>
              {d.url && (
                <Button
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  className="mt-2 flex w-full items-center justify-center gap-2 active:bg-background"
                >
                  Open preview
                  <Icon name="external" className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/** File status dot: green added, red removed, blue renamed, grey modified. */
function fileDotClass(status: string): string {
  if (status === "added") return "bg-ok";
  if (status === "removed") return "bg-blood";
  if (status === "renamed" || status === "copied") return "bg-info";
  return "bg-muted";
}

function FileRow({ file, onOpen }: { file: PrFile; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-3 rounded-xl border border-edge bg-surface px-4 py-3 font-mono text-xs active:bg-background"
    >
      <span
        aria-hidden
        className={`size-2 shrink-0 rounded-full ${fileDotClass(file.status)}`}
      />
      <span className="min-w-0 flex-1 truncate text-left" dir="rtl">
        &lrm;{file.filename}
      </span>
      <span className="shrink-0">
        <span className="text-ok">+{file.additions}</span>{" "}
        <span className="text-blood">−{file.deletions}</span>
      </span>
      <Icon name="chevron" className="size-3.5 shrink-0 -rotate-90 text-muted" />
    </button>
  );
}

/** +/− line coloring by first char — no diff library. */
function diffLineClass(line: string): string {
  if (line.startsWith("+")) return "bg-ok/10 text-ok";
  if (line.startsWith("-")) return "bg-blood/10 text-blood";
  return "text-muted";
}

type DiffRow =
  | { kind: "hunk"; text: string }
  | { kind: "line"; text: string; lineNo?: number };

/** Unified patch → hunk headers + lines with new-side line numbers. */
function parsePatch(patch: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let lineNo = 0; // new-side counter; ponytail: single gutter, dual old/new if it itches
  for (const line of patch.split("\n")) {
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) {
      lineNo = Number(hunk[1]);
      rows.push({ kind: "hunk", text: line });
    } else if (line.startsWith("-")) {
      rows.push({ kind: "line", text: line });
    } else {
      rows.push({ kind: "line", text: line, lineNo: lineNo++ });
    }
  }
  return rows;
}

function DiffSheet({ file }: { file: PrFile }) {
  return (
    <>
      <p className="break-all font-mono text-xs font-medium">{file.filename}</p>
      <p className="mt-1 mb-3 font-mono text-xs">
        <span className="uppercase tracking-widest text-muted">
          {file.status}
        </span>{" "}
        <span className="text-ok">+{file.additions}</span>{" "}
        <span className="text-blood">−{file.deletions}</span>
      </p>
      {file.patch ? (
        <div className="-mx-5 overflow-x-auto border-t border-edge">
          <div className="min-w-max px-2 py-1 font-mono text-xs leading-relaxed">
            {parsePatch(file.patch).map((row, i) =>
              row.kind === "hunk" ? (
                <div
                  key={i}
                  className="-mx-2 my-1 bg-info/10 px-3 py-1 text-[11px] text-info"
                >
                  {row.text}
                </div>
              ) : (
                <div key={i} className={`flex ${diffLineClass(row.text)}`}>
                  <span className="w-9 shrink-0 select-none pr-2 text-right text-muted/60">
                    {row.lineNo ?? ""}
                  </span>
                  <span className="whitespace-pre">{row.text || " "}</span>
                </div>
              ),
            )}
          </div>
        </div>
      ) : (
        <p className="border-t border-edge py-3 font-mono text-xs text-muted">
          {file.status} — binary or too large to diff
        </p>
      )}
    </>
  );
}
