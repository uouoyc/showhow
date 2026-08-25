"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type DragEvent,
  Fragment,
  type SubmitEvent,
  useRef,
  useState,
} from "react";

type EditorStep = {
  description: string;
  elementLabel: string;
  id: string;
  screenshotFile: string;
  sequence: number;
  title: string;
  viewportHeight: number;
  viewportWidth: number;
};

type EditorWalkthrough = {
  completions: number;
  ctaUrl: string | null;
  draftError: string | null;
  id: string;
  slug: string;
  title: string;
  views: number;
};

type DirectoryDragState = {
  bottom: number;
  insertIndex: number;
  itemOffset: number;
  midpoints: number[];
  originalIndex: number;
  stepId: string;
  top: number;
};

function InsertLine() {
  return (
    <li aria-hidden className="relative z-10 h-0">
      <span
        className="absolute -top-px right-0 left-4 block h-0.5 bg-blue-500"
        data-testid="step-insert-line"
      >
        <span className="absolute -top-1 -left-1 size-2.5 rounded-full bg-blue-500" />
        <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-blue-500" />
      </span>
    </li>
  );
}

async function requestEditorChange(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body: { error?: string } = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "Unable to save changes.");
  }
}

export function WalkthroughEditor({
  steps,
  walkthrough,
}: {
  steps: EditorStep[];
  walkthrough: EditorWalkthrough;
}) {
  const router = useRouter();
  const directoryItems = useRef(new Map<string, HTMLButtonElement>());
  const dragStateRef = useRef<DirectoryDragState | null>(null);
  const [dragState, setDragState] = useState<DirectoryDragState | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState("");

  async function runEditorAction(action: string, task: () => Promise<void>) {
    setError("");
    setMessage("");
    setPendingAction(action);
    try {
      await task();
      setMessage("Changes saved.");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Unable to save changes.",
      );
    } finally {
      setPendingAction("");
    }
  }

  function saveWalkthrough(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void runEditorAction("walkthrough", () =>
      requestEditorChange(`/api/walkthroughs/${walkthrough.id}`, {
        body: JSON.stringify({
          ctaUrl: data.get("ctaUrl"),
          title: data.get("title"),
        }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
    );
  }

  function saveStep(event: SubmitEvent<HTMLFormElement>, stepId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void runEditorAction(`save-${stepId}`, () =>
      requestEditorChange(
        `/api/walkthroughs/${walkthrough.id}/steps/${stepId}`,
        {
          body: JSON.stringify({
            description: data.get("description"),
            title: data.get("title"),
          }),
          headers: { "content-type": "application/json" },
          method: "PATCH",
        },
      ),
    );
  }

  function move(stepId: string, direction: "down" | "up") {
    void runEditorAction(`move-${stepId}`, () =>
      requestEditorChange(
        `/api/walkthroughs/${walkthrough.id}/steps/${stepId}/move`,
        {
          body: JSON.stringify({ direction }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      ),
    );
  }

  function updateDragPosition(clientY: number) {
    const current = dragStateRef.current;
    if (!current) {
      return;
    }

    let insertIndex = current.midpoints.findIndex(
      (midpoint) => clientY <= midpoint,
    );
    if (clientY <= current.top) {
      insertIndex = 0;
    } else if (clientY >= current.bottom || insertIndex === -1) {
      insertIndex = steps.length;
    }

    if (insertIndex !== current.insertIndex) {
      const next = { ...current, insertIndex };
      dragStateRef.current = next;
      setDragState(next);
    }
  }

  function finishDrag() {
    const current = dragStateRef.current;
    dragStateRef.current = null;
    setDragState(null);

    if (
      !current ||
      current.insertIndex === current.originalIndex ||
      current.insertIndex === current.originalIndex + 1
    ) {
      return;
    }

    const stepIds = steps.map((step) => step.id);
    stepIds.splice(current.originalIndex, 1);
    const finalIndex =
      current.insertIndex > current.originalIndex
        ? current.insertIndex - 1
        : current.insertIndex;
    stepIds.splice(finalIndex, 0, current.stepId);

    void runEditorAction("reorder", () =>
      requestEditorChange(`/api/walkthroughs/${walkthrough.id}/steps/reorder`, {
        body: JSON.stringify({ stepIds }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
  }

  function stepShift(index: number): number {
    if (!dragState) {
      return 0;
    }
    if (
      dragState.originalIndex < dragState.insertIndex &&
      index > dragState.originalIndex &&
      index < dragState.insertIndex
    ) {
      return -dragState.itemOffset;
    }
    if (
      dragState.insertIndex < dragState.originalIndex &&
      index >= dragState.insertIndex &&
      index < dragState.originalIndex
    ) {
      return dragState.itemOffset;
    }
    return 0;
  }

  function remove(stepId: string) {
    void runEditorAction(`delete-${stepId}`, () =>
      requestEditorChange(
        `/api/walkthroughs/${walkthrough.id}/steps/${stepId}`,
        {
          method: "DELETE",
        },
      ),
    );
  }

  async function copyToClipboard(label: string, value: string) {
    setError("");
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setError(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  function publicUrl() {
    return `${window.location.origin}/w/${walkthrough.slug}`;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase">
          Walkthrough editor
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {walkthrough.title}
        </h1>
        <Link
          className="font-medium underline underline-offset-4"
          href={`/w/${walkthrough.slug}`}
        >
          Open public Walkthrough
        </Link>
        <p className="text-sm text-zinc-500">
          {walkthrough.views} views · {walkthrough.completions} completions
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
            onClick={() => void copyToClipboard("Public link", publicUrl())}
            type="button"
          >
            Copy public link
          </button>
          <button
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
            onClick={() =>
              void copyToClipboard(
                "Embed code",
                `<iframe src="${publicUrl()}" title="Showhow Walkthrough" loading="lazy"></iframe>`,
              )
            }
            type="button"
          >
            Copy iframe
          </button>
          <a
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
            href={`/api/walkthroughs/${walkthrough.id}/export`}
          >
            Export JSON
          </a>
        </div>
      </header>

      <div className="min-h-6 text-sm" aria-live="polite">
        {error || walkthrough.draftError ? (
          <p className="text-amber-700 dark:text-amber-400">
            {error || walkthrough.draftError}
          </p>
        ) : null}
        {message ? (
          <p className="text-green-700 dark:text-green-400">{message}</p>
        ) : null}
      </div>

      <form
        className="grid gap-4 rounded-2xl bg-zinc-100 p-6 dark:bg-zinc-900"
        onSubmit={saveWalkthrough}
      >
        <label className="grid gap-2 font-medium">
          Title
          <input
            className="rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal dark:border-zinc-700 dark:bg-black"
            defaultValue={walkthrough.title}
            maxLength={120}
            name="title"
            required
          />
        </label>
        <label className="grid gap-2 font-medium">
          CTA URL
          <input
            className="rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal dark:border-zinc-700 dark:bg-black"
            defaultValue={walkthrough.ctaUrl ?? ""}
            name="ctaUrl"
            placeholder="https://example.com"
            type="url"
          />
        </label>
        <button
          className="w-fit rounded-xl bg-zinc-950 px-5 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          disabled={Boolean(pendingAction)}
          type="submit"
        >
          {pendingAction === "walkthrough" ? "Saving…" : "Save Walkthrough"}
        </button>
      </form>

      {steps.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-zinc-500 dark:border-zinc-700">
          No Steps captured yet.
        </p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <nav
            aria-label="Step directory"
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 lg:sticky lg:top-8 dark:border-zinc-800 dark:bg-zinc-950"
            onDragOver={(event: DragEvent<HTMLElement>) => {
              if (dragState && !pendingAction) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                updateDragPosition(event.clientY);
              }
            }}
            onDrop={(event: DragEvent<HTMLElement>) => {
              event.preventDefault();
              updateDragPosition(event.clientY);
            }}
          >
            <h2 className="font-semibold">Step directory</h2>
            <ol className="relative mt-4 ml-3 border-l border-zinc-300 dark:border-zinc-700">
              {steps.map((step, index) => (
                <Fragment key={step.id}>
                  {dragState?.insertIndex === index ? <InsertLine /> : null}
                  <li
                    className="relative pb-3 pl-5 last:pb-0"
                    style={{
                      transform: `translateY(${stepShift(index)}px)`,
                      transition:
                        "transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
                    }}
                  >
                    <span
                      aria-hidden
                      className="absolute top-4 -left-1.25 size-2.5 rounded-full bg-blue-600 ring-4 ring-zinc-50 dark:ring-zinc-950"
                    />
                    <button
                      aria-label={`Step ${step.sequence}: ${step.title}`}
                      className={`grid w-full cursor-grab gap-1 rounded-lg border bg-white px-3 py-2 text-left outline-none hover:border-zinc-400 focus-visible:ring-2 focus-visible:ring-blue-500 active:cursor-grabbing dark:bg-black dark:hover:border-zinc-600 ${dragState?.stepId === step.id ? "border-dashed border-blue-500 opacity-30" : "border-zinc-200 dark:border-zinc-800"}`}
                      draggable={!pendingAction}
                      onClick={() =>
                        document
                          .getElementById(`step-${step.id}`)
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                      onDragEnd={finishDrag}
                      onDragStart={(event) => {
                        const bounds = steps.map((item) =>
                          directoryItems.current
                            .get(item.id)
                            ?.getBoundingClientRect(),
                        );
                        if (bounds.some((bound) => !bound)) {
                          event.preventDefault();
                          return;
                        }
                        const rectangles = bounds as DOMRect[];
                        const current =
                          event.currentTarget.getBoundingClientRect();
                        const next: DirectoryDragState = {
                          bottom: rectangles.at(-1)?.bottom ?? current.bottom,
                          insertIndex: index,
                          itemOffset: current.height + 12,
                          midpoints: rectangles.map(
                            (rectangle) => rectangle.top + rectangle.height / 2,
                          ),
                          originalIndex: index,
                          stepId: step.id,
                          top: rectangles[0]?.top ?? current.top,
                        };
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", step.id);
                        dragStateRef.current = next;
                        setDragState(next);
                      }}
                      ref={(element) => {
                        if (element) {
                          directoryItems.current.set(step.id, element);
                        } else {
                          directoryItems.current.delete(step.id);
                        }
                      }}
                      type="button"
                    >
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                        Step {step.sequence}
                      </span>
                      <span className="truncate text-sm font-medium">
                        {step.title}
                      </span>
                    </button>
                  </li>
                </Fragment>
              ))}
              {dragState?.insertIndex === steps.length ? <InsertLine /> : null}
            </ol>
          </nav>

          <ol className="grid min-w-0 gap-6">
            {steps.map((step, index) => (
              <li
                className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
                id={`step-${step.id}`}
                key={step.id}
              >
                <Image
                  alt={`Step ${step.sequence}: ${step.elementLabel}`}
                  className="block h-auto w-full"
                  height={step.viewportHeight}
                  src={`/api/screens/${step.screenshotFile}`}
                  unoptimized
                  width={step.viewportWidth}
                />
                <form
                  className="grid gap-4 p-5"
                  onSubmit={(event) => saveStep(event, step.id)}
                >
                  <p className="text-sm text-zinc-500">Step {step.sequence}</p>
                  <a
                    className="w-fit text-sm font-medium underline underline-offset-4"
                    href={`/api/screens/${step.screenshotFile}?download=1`}
                  >
                    Download screenshot
                  </a>
                  <label className="grid gap-2 font-medium">
                    Title
                    <input
                      className="rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal dark:border-zinc-700 dark:bg-black"
                      defaultValue={step.title}
                      maxLength={120}
                      name="title"
                      required
                    />
                  </label>
                  <label className="grid gap-2 font-medium">
                    Description
                    <textarea
                      className="min-h-28 rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal dark:border-zinc-700 dark:bg-black"
                      defaultValue={step.description}
                      maxLength={2000}
                      name="description"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border border-zinc-300 px-4 py-2 disabled:opacity-40 dark:border-zinc-700"
                      disabled={index === 0 || Boolean(pendingAction)}
                      onClick={() => move(step.id, "up")}
                      type="button"
                    >
                      Move up
                    </button>
                    <button
                      className="rounded-lg border border-zinc-300 px-4 py-2 disabled:opacity-40 dark:border-zinc-700"
                      disabled={
                        index === steps.length - 1 || Boolean(pendingAction)
                      }
                      onClick={() => move(step.id, "down")}
                      type="button"
                    >
                      Move down
                    </button>
                    <button
                      className="rounded-lg bg-zinc-950 px-4 py-2 text-white disabled:opacity-40 dark:bg-white dark:text-black"
                      disabled={Boolean(pendingAction)}
                      type="submit"
                    >
                      {pendingAction === `save-${step.id}`
                        ? "Saving…"
                        : "Save Step"}
                    </button>
                    <button
                      className="rounded-lg px-4 py-2 text-red-700 disabled:opacity-40 dark:text-red-400"
                      disabled={Boolean(pendingAction)}
                      onClick={() => remove(step.id)}
                      type="button"
                    >
                      {pendingAction === `delete-${step.id}`
                        ? "Deleting…"
                        : "Delete"}
                    </button>
                  </div>
                </form>
              </li>
            ))}
          </ol>
        </div>
      )}
    </main>
  );
}
