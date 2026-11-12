import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing the Manus OAuth flow.
 * Application-owned workspace records use this numeric key for row ownership.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type SavedResearchMode = "quick" | "deep" | "eli10" | "expert" | "step" | "compare" | "discovery";
export type SavedSource = {
  title: string;
  url: string;
  publisher: string | null;
  publishedAt: string | null;
  authors: string[];
};

/** Research snapshots are private, durable, and always scoped to the owning account. */
export const savedResearch = mysqlTable("saved_research", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 240 }).notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  mode: mysqlEnum("mode", ["quick", "deep", "eli10", "expert", "step", "compare", "discovery"]).default("quick").notNull(),
  sources: json("sources").$type<SavedSource[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, table => ({
  ownerUpdatedIndex: index("saved_research_owner_updated_idx").on(table.userId, table.updatedAt),
}));

export type SavedResearch = typeof savedResearch.$inferSelect;
