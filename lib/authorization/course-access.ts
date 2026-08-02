import type { CourseStatus, OrganizationRole } from "@/types/domain";

type CourseAccessRecord = {
  ownerId: string;
  organizationId: string | null;
  status: CourseStatus;
};

type CourseAccessContext = {
  userId?: string;
  organizationRole?: OrganizationRole;
  isPlatformContentManager?: boolean;
};

const managerRoles: OrganizationRole[] = ["owner", "admin", "content", "teacher"];

export function canReadCourse(
  course: CourseAccessRecord,
  context: CourseAccessContext,
) {
  if (course.ownerId === context.userId) return true;

  if (!course.organizationId) {
    return course.status === "published" || Boolean(context.isPlatformContentManager);
  }

  if (!context.organizationRole) return false;
  return course.status === "published" || managerRoles.includes(context.organizationRole);
}
