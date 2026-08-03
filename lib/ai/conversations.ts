import { and, asc, count, desc, eq, ilike } from "drizzle-orm";
import { db } from "@/db";
import { aiConversations, aiMessages } from "@/db/schema/learning";
import { AppError } from "@/lib/api/response";

type ConversationQuery = {
  page: number;
  pageSize: number;
  search?: string;
  status?: "active" | "closed";
  sort: "newest" | "oldest";
};

export async function listTutorConversations(userId: string, query: ConversationQuery) {
  const filters = [eq(aiConversations.userId, userId)];
  if (query.status) filters.push(eq(aiConversations.status, query.status));
  if (query.search) filters.push(ilike(aiConversations.title, `%${query.search}%`));
  const where = and(...filters);

  const [items, [{ total }]] = await Promise.all([
    db
      .select()
      .from(aiConversations)
      .where(where)
      .orderBy(query.sort === "oldest" ? asc(aiConversations.createdAt) : desc(aiConversations.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(aiConversations).where(where),
  ]);

  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}

export async function getTutorConversation(userId: string, conversationId: string) {
  const [conversation] = await db
    .select()
    .from(aiConversations)
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
    .limit(1);
  if (!conversation) throw new AppError("NOT_FOUND", "Conversation not found", 404);

  const messages = await db
    .select()
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(asc(aiMessages.createdAt));
  return { ...conversation, messages };
}

export async function closeTutorConversation(userId: string, conversationId: string) {
  const [conversation] = await db
    .update(aiConversations)
    .set({ status: "closed", endedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
    .returning();
  if (!conversation) throw new AppError("NOT_FOUND", "Conversation not found", 404);
  return conversation;
}
