import { and, eq } from "drizzle-orm";
import { steps, walkthroughs } from "@/db/schema";
import { db } from "@/lib/database";
import { listSteps } from "@/lib/steps";
import { findWalkthroughById } from "@/lib/walkthroughs";

export type DescriptionDraftProvider = (
  steps: Array<{ captureId: string; elementLabel: string }>,
) => Promise<Array<{ captureId: string; description: string }>>;

export class WalkthroughNotFoundError extends Error {}

export async function finalizeWalkthrough(
  walkthroughId: string,
  draftDescriptions?: DescriptionDraftProvider,
): Promise<{ drafted: boolean; warning: string | null }> {
  const walkthrough = findWalkthroughById(walkthroughId);

  if (!walkthrough) {
    throw new WalkthroughNotFoundError();
  }
  if (!draftDescriptions || walkthrough.draftedAt) {
    return { drafted: false, warning: walkthrough.draftError };
  }

  const capturedSteps = listSteps(walkthroughId);

  try {
    const drafts = await draftDescriptions(
      capturedSteps.map((step) => ({
        captureId: step.captureId,
        elementLabel: step.elementLabel,
      })),
    );
    const capturedIds = new Set(capturedSteps.map((step) => step.captureId));
    const draftIds = new Set(drafts.map((draft) => draft.captureId));

    if (
      drafts.length !== capturedSteps.length ||
      draftIds.size !== capturedIds.size ||
      drafts.some(
        (draft) =>
          !capturedIds.has(draft.captureId) ||
          draft.description.trim().length === 0 ||
          draft.description.length > 2000,
      )
    ) {
      throw new Error("Invalid description drafts.");
    }

    db.transaction((transaction) => {
      for (const draft of drafts) {
        const captured = capturedSteps.find(
          (step) => step.captureId === draft.captureId,
        );
        if (!captured) {
          continue;
        }
        transaction
          .update(steps)
          .set({ description: draft.description.trim() })
          .where(
            and(
              eq(steps.id, captured.id),
              eq(steps.description, captured.elementLabel),
            ),
          )
          .run();
      }
      transaction
        .update(walkthroughs)
        .set({ draftError: null, draftedAt: new Date() })
        .where(eq(walkthroughs.id, walkthroughId))
        .run();
    });

    return { drafted: true, warning: null };
  } catch {
    db.update(walkthroughs)
      .set({
        draftError: "AI drafting failed. Recorded labels were kept.",
        draftedAt: new Date(),
      })
      .where(eq(walkthroughs.id, walkthroughId))
      .run();
    return {
      drafted: false,
      warning: "AI drafting failed. Recorded labels were kept.",
    };
  }
}
