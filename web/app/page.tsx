import Link from "next/link";
import { CreateWalkthroughForm } from "@/app/create-walkthrough-form";
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
        <p className="max-w-xl text-zinc-600 dark:text-zinc-400">
          Record browser interactions and publish them as interactive
          walkthroughs.
        </p>
      </header>

      <CreateWalkthroughForm />

      <section className="space-y-4" aria-labelledby="walkthrough-list-heading">
        <h2 id="walkthrough-list-heading" className="text-xl font-semibold">
          Your Walkthroughs
        </h2>
        {walkthroughs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-zinc-500 dark:border-zinc-700">
            No Walkthroughs yet. Create one to start recording.
          </p>
        ) : (
          <ul className="grid gap-3">
            {walkthroughs.map((walkthrough) => (
              <li key={walkthrough.id}>
                <Link
                  className="block rounded-2xl border border-zinc-200 p-5 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                  href={`/w/${walkthrough.slug}`}
                >
                  <span className="font-medium">{walkthrough.title}</span>
                  <span className="mt-1 block text-sm text-zinc-500">
                    /w/{walkthrough.slug}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
