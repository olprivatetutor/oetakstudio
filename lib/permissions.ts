import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  courses,
  organizationMembers,
  type organizationRoleEnum,
} from "@/db/schema/learning";

type OrganizationRole = (typeof organizationRoleEnum.enumValues)[number];

const courseManagerRoles: OrganizationRole[] = ["owner", "admin", "content", "teacher"];
const orgAdminRoles: OrganizationRole[] = ["owner", "admin"];

export function isOrganizationAdmin(role: OrganizationRole) {
  return orgAdminRoles.includes(role);
}

export function isCourseManager(role: OrganizationRole) {
  return courseManagerRoles.includes(role);
}

export async function getOrganizationMembership(
  userId: string,
  organizationId: string,
) {
  const [membership] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.status, "active"),
      ),
    )
    .limit(1);

  return membership;
}

export async function canManageOrganization(
  userId: string,
  organizationId: string,
) {
  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, organizationId),
        inArray(organizationMembers.role, orgAdminRoles),
        eq(organizationMembers.status, "active"),
      ),
    )
    .limit(1);

  return Boolean(membership);
}

export async function canManageCourse(userId: string, courseId: string) {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));

  if (!course) {
    return { allowed: false, course: null };
  }

  if (course.ownerId === userId) {
    return { allowed: true, course };
  }

  if (!course.organizationId) {
    return { allowed: false, course };
  }

  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, course.organizationId),
        inArray(organizationMembers.role, courseManagerRoles),
        eq(organizationMembers.status, "active"),
      ),
    )
    .limit(1);

  return { allowed: Boolean(membership), course };
}
