import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import {
  organizationInvitations,
  organizationMembers,
} from "@/db/schema/learning";

export async function findOrganizationMembership(
  organizationId: string,
  userId: string,
) {
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);
  return membership ?? null;
}

export async function listOrganizationMembers(organizationId: string) {
  return db
    .select({
      userId: organizationMembers.userId,
      name: user.name,
      email: user.email,
      role: organizationMembers.role,
      status: organizationMembers.status,
      joinedAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(user, eq(user.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, organizationId))
    .orderBy(asc(user.name));
}

export async function listPendingInvitations(organizationId: string) {
  return db
    .select({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      status: organizationInvitations.status,
      expiresAt: organizationInvitations.expiresAt,
      createdAt: organizationInvitations.createdAt,
    })
    .from(organizationInvitations)
    .where(
      and(
        eq(organizationInvitations.organizationId, organizationId),
        eq(organizationInvitations.status, "pending"),
      ),
    )
    .orderBy(asc(organizationInvitations.email));
}
