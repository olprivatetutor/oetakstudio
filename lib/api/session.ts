import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/api/response";

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

  return session.user;
}
