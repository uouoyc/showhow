import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { type Walkthrough, walkthroughs } from "@/db/schema";
import { db } from "@/lib/database";

export class InvalidWalkthroughTitleError extends Error {}

function normalizeTitle(title: unknown): string {
  if (typeof title !== "string") {
    throw new InvalidWalkthroughTitleError();
  }

  const normalizedTitle = title.trim();

  if (normalizedTitle.length === 0 || normalizedTitle.length > 120) {
    throw new InvalidWalkthroughTitleError();
  }

  return normalizedTitle;
}

export function createWalkthrough(title: unknown): Walkthrough {
  const normalizedTitle = normalizeTitle(title);

  const now = new Date();

  return db
    .insert(walkthroughs)
    .values({
      id: randomUUID(),
      slug: randomUUID().replaceAll("-", "").slice(0, 12),
      title: normalizedTitle,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
}

export function listWalkthroughs(): Walkthrough[] {
  return db
    .select()
    .from(walkthroughs)
    .orderBy(desc(walkthroughs.createdAt))
    .all();
}

export function findWalkthroughBySlug(slug: string): Walkthrough | undefined {
  return db
    .select()
    .from(walkthroughs)
    .where(eq(walkthroughs.slug, slug))
    .get();
}

export function findWalkthroughById(id: string): Walkthrough | undefined {
  return db.select().from(walkthroughs).where(eq(walkthroughs.id, id)).get();
}
