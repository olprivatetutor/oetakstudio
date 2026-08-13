import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/api/response";
import { ensurePersonalWorkspaceForUser } from "@/lib/services/workspace";

export async function getCurrentSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireUser() {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    throw new AppError(
      "AUTHENTICATION_REQUIRED",
      "Please sign in to continue",
      401,
    );
  }

  // Sessions are issued only to verified email/password accounts in the
  // current Better Auth configuration. This idempotent reconciliation also
  // covers verified social accounts and repairs a transient failure in the
  // post-verification callback without exposing a bootstrap endpoint.
  if (session.user.emailVerified) {
    await ensurePersonalWorkspaceForUser(session.user);
  }

  return session.user;
}
