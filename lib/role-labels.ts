import type { OrganizationRole } from "@/types/domain";

export function formatOrganizationRole(role: OrganizationRole) {
  const labels: Record<string, string> = {
    owner: "Organization owner",
    admin: "Organization manager",
    teacher: "Teacher",
    content: "Content creator",
    learner: "Learner",
    guardian: "Guardian",
  };

  return labels[role] ?? role;
}
