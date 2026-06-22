import { Router } from "express";
import { db, phrasesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/phrases", async (req, res) => {
  const userId = req.query["userId"] as string | undefined;
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  const phrases = await db
    .select()
    .from(phrasesTable)
    .where(eq(phrasesTable.userId, userId.trim()))
    .orderBy(desc(phrasesTable.createdAt))
    .limit(500);
  res.json({ phrases });
});

router.post("/phrases", async (req, res) => {
  const { userId, text, category } = req.body as { userId?: unknown; text?: unknown; category?: unknown };
  if (!userId || typeof userId !== "string" || !text || typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "userId and text are required" });
    return;
  }
  const [phrase] = await db
    .insert(phrasesTable)
    .values({ userId: userId.trim(), text: text.trim().slice(0, 2000), category: typeof category === "string" ? category : undefined })
    .returning();
  res.status(201).json({ phrase });
});

router.delete("/phrases/:id", async (req, res) => {
  const { id } = req.params as { id: string };
  if (!id) { res.status(400).json({ error: "id is required" }); return; }
  await db.delete(phrasesTable).where(eq(phrasesTable.id, id));
  res.json({ ok: true });
});

export default router;
