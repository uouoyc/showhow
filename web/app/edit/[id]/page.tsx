import { notFound } from "next/navigation";
import { WalkthroughEditor } from "@/app/edit/[id]/walkthrough-editor";
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

  return (
    <WalkthroughEditor
      steps={listSteps(id).map((step) => ({
        description: step.description,
        elementLabel: step.elementLabel,
        id: step.id,
        screenshotFile: step.screenshotFile,
        sequence: step.sequence,
        title: step.title,
        viewportHeight: step.viewportHeight,
        viewportWidth: step.viewportWidth,
      }))}
      walkthrough={{
        ctaUrl: walkthrough.ctaUrl,
        draftError: walkthrough.draftError,
        id: walkthrough.id,
        slug: walkthrough.slug,
        title: walkthrough.title,
      }}
    />
  );
}
