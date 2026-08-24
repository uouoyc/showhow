import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const walkthroughs = sqliteTable("walkthroughs", {
  id: text().primaryKey(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type Walkthrough = typeof walkthroughs.$inferSelect;
