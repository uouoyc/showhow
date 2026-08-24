"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-4 px-6">
      <h1 className="text-2xl font-semibold">Unable to load Walkthroughs</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Your data is unchanged. Try loading it again.
      </p>
      <button
        className="w-fit rounded-xl bg-zinc-950 px-5 py-3 font-medium text-white dark:bg-white dark:text-black"
        onClick={reset}
        type="button"
      >
        Try again
      </button>
    </main>
  );
}
