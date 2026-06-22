import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const phrasesTable = pgTable("phrases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  text: text("text").notNull(),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Phrase = typeof phrasesTable.$inferSelect;
export type InsertPhrase = typeof phrasesTable.$inferInsert;
