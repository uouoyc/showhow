import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listSteps } from "@/lib/steps";
import { findWalkthroughById } from "@/lib/walkthroughs";

export const dynamic = "force-dynamic";

export default async function EditWalkthroughPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const walkthrough = findWalkthroughById(id);

  if (!walkthrough) {
    notFound();
  }

  const steps = listSteps(id);

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

      {steps.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-300 p-8 text-zinc-500 dark:border-zinc-700">
          No Steps captured yet.
        </p>
      ) : (
        <ol className="grid gap-6">
          {steps.map((step) => (
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
              <div className="space-y-1 p-5">
                <p className="text-sm text-zinc-500">Step {step.sequence}</p>
                <p className="font-medium">{step.elementLabel}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
