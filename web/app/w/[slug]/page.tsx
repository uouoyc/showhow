import { notFound } from "next/navigation";
import { WalkthroughReplay } from "@/app/w/[slug]/walkthrough-replay";
import { listSteps } from "@/lib/steps";
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
    <WalkthroughReplay
      ctaUrl={walkthrough.ctaUrl}
      steps={listSteps(walkthrough.id).map((step) => ({
        clickX: step.clickX,
        clickY: step.clickY,
        description: step.description,
        id: step.id,
        screenshotFile: step.screenshotFile,
        title: step.title,
        viewportHeight: step.viewportHeight,
        viewportWidth: step.viewportWidth,
      }))}
      title={walkthrough.title}
    />
  );
}
