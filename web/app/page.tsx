import Link from "next/link";
import { ImportWalkthrough } from "@/app/import-walkthrough";
import { listWalkthroughs } from "@/lib/walkthroughs";

export const dynamic = "force-dynamic";

export default function Home() {
  const walkthroughs = listWalkthroughs();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase">
          Showhow
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Walkthroughs</h1>
      </header>

      <ImportWalkthrough />

      <section className="space-y-4" aria-labelledby="walkthrough-list-heading">
        {walkthroughs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-zinc-500 dark:border-zinc-700">
            No Walkthroughs yet. Start a Recording from the Chrome extension.
          </p>
        ) : (
          <ul className="grid gap-3">
            {walkthroughs.map((walkthrough) => (
              <li
                className="flex overflow-hidden rounded-2xl border border-zinc-200 transition hover:border-zinc-400 focus-within:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600 dark:focus-within:border-zinc-600"
                key={walkthrough.id}
              >
                <Link
                  aria-label={`Edit ${walkthrough.title}`}
                  className="min-w-0 flex-1 p-5 outline-none"
                  href={`/edit/${walkthrough.id}`}
                >
                  <span className="font-medium">{walkthrough.title}</span>
                  <span className="mt-1 block text-sm text-zinc-500">
                    /w/{walkthrough.slug}
                  </span>
                  <span className="mt-3 block text-sm font-medium underline underline-offset-4">
                    Edit Walkthrough
                  </span>
                </Link>
                <Link
                  aria-label={`View ${walkthrough.title} public Walkthrough`}
                  className="flex items-center border-l border-zinc-200 px-5 text-sm font-medium underline underline-offset-4 outline-none dark:border-zinc-800"
                  href={`/w/${walkthrough.slug}`}
                >
                  View public
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
