"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { scaleHotspot } from "@/lib/hotspot";

type ReplayStep = {
  clickX: number;
  clickY: number;
  description: string;
  id: string;
  screenshotFile: string;
  title: string;
  viewportHeight: number;
  viewportWidth: number;
};

export function WalkthroughReplay({
  ctaUrl,
  steps,
  title,
}: {
  ctaUrl: string | null;
  steps: ReplayStep[];
  title: string;
}) {
  const [finished, setFinished] = useState(false);
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);

  const advance = useCallback(() => {
    if (index >= steps.length - 1) {
      setFinished(true);
      return;
    }
    setIndex((current) => current + 1);
  }, [index, steps.length]);

  const back = useCallback(() => {
    if (finished) {
      setFinished(false);
      setIndex(Math.max(0, steps.length - 1));
      return;
    }
    setIndex((current) => Math.max(0, current - 1));
  }, [finished, steps.length]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (!started) {
        return;
      }
      if (event.key === "ArrowRight" && !finished) {
        advance();
      }
      if (event.key === "ArrowLeft" && (finished || index > 0)) {
        back();
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [advance, back, finished, index, started]);

  if (steps.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-5 px-6">
        <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
        <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-zinc-500 dark:border-zinc-700">
          No Steps have been recorded yet.
        </p>
      </main>
    );
  }

  if (!started) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase">
          Interactive Walkthrough
        </p>
        <h1 className="text-5xl font-semibold tracking-tight">{title}</h1>
        <p className="text-zinc-500">{steps.length} Steps</p>
        <button
          className="rounded-xl bg-zinc-950 px-6 py-3 font-medium text-white outline-none focus-visible:ring-4 focus-visible:ring-zinc-400 dark:bg-white dark:text-black"
          onClick={() => setStarted(true)}
          type="button"
        >
          Start Walkthrough
        </button>
      </main>
    );
  }

  if (finished) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
        <p className="text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase">
          Walkthrough complete
        </p>
        <h1 className="text-5xl font-semibold tracking-tight">{title}</h1>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            className="rounded-xl border border-zinc-300 px-6 py-3 font-medium outline-none focus-visible:ring-4 focus-visible:ring-zinc-400 dark:border-zinc-700"
            onClick={back}
            type="button"
          >
            Back to final Step
          </button>
          {ctaUrl ? (
            <a
              className="rounded-xl bg-zinc-950 px-6 py-3 font-medium text-white outline-none focus-visible:ring-4 focus-visible:ring-zinc-400 dark:bg-white dark:text-black"
              href={ctaUrl}
              rel="noreferrer"
            >
              Continue
            </a>
          ) : null}
        </div>
      </main>
    );
  }

  const step = steps[index];
  const hotspot = scaleHotspot(step, { height: 100, width: 100 });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center gap-5 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-zinc-500">
            Step {index + 1} of {steps.length}
          </p>
          <h1 className="text-2xl font-semibold">{step.title}</h1>
        </div>
        <button
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium outline-none disabled:opacity-40 focus-visible:ring-4 focus-visible:ring-zinc-400 dark:border-zinc-700"
          disabled={index === 0}
          onClick={back}
          type="button"
        >
          Previous Step
        </button>
      </header>

      <div
        className="step-enter relative overflow-hidden rounded-2xl border border-zinc-200 bg-black shadow-2xl dark:border-zinc-800"
        key={step.id}
      >
        <Image
          alt={step.title}
          className="block h-auto w-full"
          height={step.viewportHeight}
          priority
          src={`/api/screens/${step.screenshotFile}`}
          unoptimized
          width={step.viewportWidth}
        />
        <button
          aria-label={
            index === steps.length - 1
              ? "Complete Walkthrough"
              : `Continue to Step ${index + 2}`
          }
          className="absolute size-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-blue-600 shadow-lg outline-none focus-visible:ring-4 focus-visible:ring-blue-300"
          onClick={advance}
          style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
          type="button"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-blue-500 opacity-60" />
        </button>
      </div>

      <p className="max-w-3xl text-zinc-600 dark:text-zinc-400">
        {step.description}
      </p>
      <p className="text-sm text-zinc-500">
        Use the Hotspot or arrow keys to continue.
      </p>
    </main>
  );
}
