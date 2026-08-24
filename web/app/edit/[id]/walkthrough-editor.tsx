"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

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
  ctaUrl: string | null;
  id: string;
  slug: string;
  title: string;
};

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

  function saveWalkthrough(event: FormEvent<HTMLFormElement>) {
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

  function saveStep(event: FormEvent<HTMLFormElement>, stepId: string) {
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-6 py-16">
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
      </header>

      <div className="min-h-6 text-sm" aria-live="polite">
        {error ? (
          <p className="text-red-700 dark:text-red-400">{error}</p>
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
          Walkthrough title
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
        <ol className="grid gap-6">
          {steps.map((step, index) => (
            <li
              className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800"
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
      )}
    </main>
  );
}
