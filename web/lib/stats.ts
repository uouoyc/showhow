import { eq, sql } from "drizzle-orm";
import { completionReceipts, walkthroughs } from "@/db/schema";
import { db } from "@/lib/database";

export function recordView(walkthroughId: string): void {
  db.update(walkthroughs)
    .set({ views: sql`${walkthroughs.views} + 1` })
    .where(eq(walkthroughs.id, walkthroughId))
    .run();
}

export function recordCompletion(
  walkthroughId: string,
  completionId: string,
): boolean {
  if (!/^[a-f0-9-]{36}$/i.test(completionId)) {
    return false;
  }

  return db.transaction((transaction) => {
    const receipt = transaction
      .insert(completionReceipts)
      .values({ id: completionId, walkthroughId })
      .onConflictDoNothing()
      .run();

    if (receipt.changes === 0) {
      return true;
    }

    return Boolean(
      transaction
        .update(walkthroughs)
        .set({ completions: sql`${walkthroughs.completions} + 1` })
        .where(eq(walkthroughs.id, walkthroughId))
        .returning({ id: walkthroughs.id })
        .get(),
    );
  });
}
