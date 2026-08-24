"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export function CreateWalkthroughForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      const response = await fetch("/api/walkthroughs", {
        body: JSON.stringify({ title: data.get("title") }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body: { error?: string } = await response.json();
        throw new Error(body.error ?? "Unable to create Walkthrough.");
      }

      form.reset();
      setSuccess("Walkthrough created.");
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to create Walkthrough.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="rounded-2xl bg-zinc-100 p-6 dark:bg-zinc-900"
      onSubmit={submit}
    >
      <label className="block text-sm font-medium" htmlFor="title">
        Walkthrough title
      </label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-3 outline-none focus:border-zinc-950 dark:border-zinc-700 dark:bg-black dark:focus:border-white"
          id="title"
          maxLength={120}
          name="title"
          placeholder="Record the onboarding flow"
          required
        />
        <button
          className="rounded-xl bg-zinc-950 px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-black"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creating…" : "Create"}
        </button>
      </div>
      <div className="mt-3 min-h-6 text-sm" aria-live="polite">
        {error ? (
          <p className="text-red-700 dark:text-red-400">{error}</p>
        ) : null}
        {success ? (
          <p className="text-green-700 dark:text-green-400">{success}</p>
        ) : null}
      </div>
    </form>
  );
}
