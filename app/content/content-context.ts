import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/api/session";
import { getAppAdmin } from "@/lib/services/app-admin";

export async function requireContentStudioPageUser() {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const admin = await getAppAdmin(session.user.id);

  if (!admin || !["owner", "content"].includes(admin.role)) {
    redirect("/dashboard");
  }

  return { user: session.user, admin };
}
