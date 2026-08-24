import { listSteps } from "@/lib/steps";
import { findWalkthroughById } from "@/lib/walkthroughs";

export function exportWalkthrough(walkthroughId: string) {
  const walkthrough = findWalkthroughById(walkthroughId);

  if (!walkthrough) {
    return undefined;
  }

  return {
    walkthrough: {
      ctaUrl: walkthrough.ctaUrl,
      slug: walkthrough.slug,
      title: walkthrough.title,
    },
    steps: listSteps(walkthroughId).map((step) => ({
      captureId: step.captureId,
      clickX: step.clickX,
      clickY: step.clickY,
      description: step.description,
      elementLabel: step.elementLabel,
      elementRect: {
        height: step.rectHeight,
        width: step.rectWidth,
        x: step.rectX,
        y: step.rectY,
      },
      pageUrl: step.pageUrl,
      screenshotFile: step.screenshotFile,
      sequence: step.sequence,
      title: step.title,
      viewportHeight: step.viewportHeight,
      viewportWidth: step.viewportWidth,
    })),
  };
}
