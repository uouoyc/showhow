import Link from "next/link";
import { notFound } from "next/navigation";
import { findWalkthroughBySlug } from "@/lib/walkthroughs";

export const dynamic = "force-dynamic";

export default async function WalkthroughPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const walkthrough = findWalkthroughBySlug(slug);

  if (!walkthrough) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-5 px-6">
      <p className="text-sm font-medium tracking-[0.2em] text-zinc-500 uppercase">
        Showhow
      </p>
      <h1 className="text-4xl font-semibold tracking-tight">
        {walkthrough.title}
      </h1>
      <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-zinc-500 dark:border-zinc-700">
        No Steps have been recorded yet.
      </p>
      <Link className="font-medium underline underline-offset-4" href="/">
        Back to Walkthroughs
      </Link>
    </main>
  );
}
