"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { maxPortableImportBytes } from "@/lib/portable-limits";

export function ImportWalkthrough() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function importFile(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      const file = new FormData(event.currentTarget).get("walkthrough");
      if (!(file instanceof File)) {
        throw new Error("Choose a Showhow JSON export.");
      }
      if (file.size > maxPortableImportBytes) {
        throw new Error("Showhow export is too large.");
      }
      const response = await fetch("/api/walkthroughs/import", {
        body: await file.text(),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const body: {
        error?: string;
        walkthrough?: { id?: string };
      } = await response.json();
      if (!response.ok || !body.walkthrough?.id) {
        throw new Error(body.error ?? "Unable to import Walkthrough.");
      }
      router.push(`/edit/${body.walkthrough.id}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to import Walkthrough.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      className="grid gap-3 rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800"
      onSubmit={importFile}
    >
      <label className="grid gap-2 font-medium">
        Import Walkthrough JSON
        <input
          accept=".json,application/json"
          className="rounded-xl border border-zinc-300 bg-white px-4 py-3 font-normal dark:border-zinc-700 dark:bg-black"
          name="walkthrough"
          required
          type="file"
        />
      </label>
      <button
        className="w-fit rounded-xl bg-zinc-950 px-5 py-3 font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        disabled={pending}
        type="submit"
      >
        {pending ? "Importing…" : "Import Walkthrough"}
      </button>
      <p aria-live="polite" className="min-h-5 text-sm text-red-700">
        {error}
      </p>
    </form>
  );
}
