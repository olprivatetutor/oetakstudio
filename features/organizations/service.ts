import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  auditLogs,
  organizationInvitations,
  organizationMembers,
  organizations,
} from "@/db/schema/learning";
import { AppError } from "@/lib/api/response";
import { canManageOrganization, getOrganizationMembership } from "@/lib/permissions";
import type { OrganizationRole } from "@/types/domain";
import {
  findOrganizationMembership,
  listOrganizationMembers,
  listPendingInvitations,
} from "@/features/organizations/repository";

type User = { id: string; email?: string | null };

function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function requireOrganizationAdmin(userId: string, organizationId: string) {
  if (!(await canManageOrganization(userId, organizationId))) {
    throw new AppError("FORBIDDEN", "Organization owner or admin access is required", 403);
  }
}

export async function getOrganizationMembers(currentUser: User, organizationId: string) {
  await requireOrganizationAdmin(currentUser.id, organizationId);
  const [members, invitations] = await Promise.all([
    listOrganizationMembers(organizationId),
    listPendingInvitations(organizationId),
  ]);
  return { members, invitations };
}

export async function inviteOrganizationMember(
  currentUser: User,
  organizationId: string,
  input: { email: string; role: Exclude<OrganizationRole, "owner"> },
) {
  await requireOrganizationAdmin(currentUser.id, organizationId);

  const [organization] = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!organization) throw new AppError("NOT_FOUND", "Organization not found", 404);

  const normalizedEmail = input.email.trim().toLowerCase();
  const existingMembers = await listOrganizationMembers(organizationId);
  if (existingMembers.some((member) => member.email.toLowerCase() === normalizedEmail && member.status === "active")) {
    throw new AppError("CONFLICT", "This user is already an active organization member", 409);
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashInvitationToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const invitation = await db.transaction(async (tx) => {
    await tx
      .update(organizationInvitations)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(
        and(
          eq(organizationInvitations.organizationId, organizationId),
          eq(organizationInvitations.email, normalizedEmail),
          eq(organizationInvitations.status, "pending"),
        ),
      );

    const [created] = await tx
      .insert(organizationInvitations)
      .values({
        organizationId,
        email: normalizedEmail,
        role: input.role,
        tokenHash,
        invitedById: currentUser.id,
        expiresAt,
      })
      .returning();

    await tx.insert(auditLogs).values({
      actorUserId: currentUser.id,
      organizationId,
      action: "organization.member_invited",
      entityType: "organization_invitation",
      entityId: created.id,
      metadata: { email: normalizedEmail, role: input.role },
    });

    return created;
  });

  const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    },
    inviteUrl: `${baseUrl}/dashboard/organization/invitations?token=${encodeURIComponent(token)}`,
  };
}

export async function acceptOrganizationInvitation(currentUser: User, token: string) {
  if (!currentUser.email) {
    throw new AppError("VALIDATION_ERROR", "The signed-in account has no email address", 400);
  }

  const tokenHash = hashInvitationToken(token);
  const [invitation] = await db
    .select()
    .from(organizationInvitations)
    .where(
      and(
        eq(organizationInvitations.tokenHash, tokenHash),
        eq(organizationInvitations.status, "pending"),
      ),
    )
    .limit(1);

  if (!invitation) throw new AppError("NOT_FOUND", "Invitation is invalid or no longer active", 404);
  if (invitation.expiresAt <= new Date()) {
    await db
      .update(organizationInvitations)
      .set({ status: "expired", updatedAt: new Date() })
      .where(eq(organizationInvitations.id, invitation.id));
    throw new AppError("CONFLICT", "Invitation has expired", 409);
  }
  if (invitation.email !== currentUser.email.trim().toLowerCase()) {
    throw new AppError("FORBIDDEN", "Sign in with the email address that received this invitation", 403);
  }

  return db.transaction(async (tx) => {
    const [membership] = await tx
      .insert(organizationMembers)
      .values({
        organizationId: invitation.organizationId,
        userId: currentUser.id,
        role: invitation.role,
        status: "active",
      })
      .onConflictDoUpdate({
        target: [organizationMembers.organizationId, organizationMembers.userId],
        set: { role: invitation.role, status: "active", updatedAt: new Date() },
      })
      .returning();

    await tx
      .update(organizationInvitations)
      .set({ status: "accepted", acceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(organizationInvitations.id, invitation.id));

    await tx.insert(auditLogs).values({
      actorUserId: currentUser.id,
      organizationId: invitation.organizationId,
      action: "organization.invitation_accepted",
      entityType: "organization_member",
      entityId: currentUser.id,
    });
    return membership;
  });
}

export async function updateOrganizationMemberRole(
  currentUser: User,
  organizationId: string,
  memberUserId: string,
  role: Exclude<OrganizationRole, "owner">,
) {
  await requireOrganizationAdmin(currentUser.id, organizationId);
  const membership = await findOrganizationMembership(organizationId, memberUserId);
  if (!membership) throw new AppError("NOT_FOUND", "Organization member not found", 404);
  if (membership.role === "owner") {
    throw new AppError("FORBIDDEN", "Transfer ownership before changing the owner role", 403);
  }

  const [updated] = await db
    .update(organizationMembers)
    .set({ role, updatedAt: new Date() })
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, memberUserId),
      ),
    )
    .returning();
  return updated;
}

export async function removeOrganizationMember(
  currentUser: User,
  organizationId: string,
  memberUserId: string,
) {
  await requireOrganizationAdmin(currentUser.id, organizationId);
  const membership = await findOrganizationMembership(organizationId, memberUserId);
  if (!membership) throw new AppError("NOT_FOUND", "Organization member not found", 404);
  if (membership.role === "owner") {
    throw new AppError("FORBIDDEN", "The organization owner cannot be removed", 403);
  }

  const [updated] = await db
    .update(organizationMembers)
    .set({ status: "removed", updatedAt: new Date() })
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, memberUserId),
      ),
    )
    .returning();
  return updated;
}

export async function assertOrganizationMembership(currentUser: User, organizationId: string) {
  const membership = await getOrganizationMembership(currentUser.id, organizationId);
  if (!membership) throw new AppError("FORBIDDEN", "Organization access is required", 403);
  return membership;
}
