import { getCurrentSession } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { getAppAdmin } from "@/lib/services/app-admin";

export async function GET() {
  try {
    const session = await getCurrentSession();

    if (!session?.user?.id) {
      return successResponse({
        isAppOwner: false,
        canAccessOwnerConsole: false,
        canAccessContentStudio: false,
        role: null,
      });
    }

    const appAdmin = await getAppAdmin(session.user.id);
    const canAccessOwnerConsole = Boolean(appAdmin && ["owner", "admin"].includes(appAdmin.role));
    const canAccessContentStudio = Boolean(appAdmin && ["owner", "content"].includes(appAdmin.role));

    return successResponse({
      isAppOwner: canAccessOwnerConsole,
      canAccessOwnerConsole,
      canAccessContentStudio,
      role: appAdmin?.role ?? null,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
