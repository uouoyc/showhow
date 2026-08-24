import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const walkthroughs = sqliteTable("walkthroughs", {
  id: text().primaryKey(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  ctaUrl: text("cta_url"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export type Walkthrough = typeof walkthroughs.$inferSelect;

export const steps = sqliteTable(
  "steps",
  {
    id: text().primaryKey(),
    walkthroughId: text("walkthrough_id")
      .notNull()
      .references(() => walkthroughs.id, { onDelete: "cascade" }),
    captureId: text("capture_id").notNull(),
    sequence: integer().notNull(),
    screenshotFile: text("screenshot_file").notNull(),
    pageUrl: text("page_url").notNull(),
    elementLabel: text("element_label").notNull(),
    title: text().notNull().default(""),
    description: text().notNull().default(""),
    clickX: real("click_x").notNull(),
    clickY: real("click_y").notNull(),
    viewportWidth: integer("viewport_width").notNull(),
    viewportHeight: integer("viewport_height").notNull(),
    rectX: real("rect_x").notNull(),
    rectY: real("rect_y").notNull(),
    rectWidth: real("rect_width").notNull(),
    rectHeight: real("rect_height").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("steps_capture_unique").on(
      table.walkthroughId,
      table.captureId,
    ),
    uniqueIndex("steps_sequence_unique").on(
      table.walkthroughId,
      table.sequence,
    ),
  ],
);

export type Step = typeof steps.$inferSelect;
