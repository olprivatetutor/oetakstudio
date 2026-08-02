import { NextRequest } from "next/server";
import { requireUser } from "@/lib/api/session";
import { handleRouteError, successResponse } from "@/lib/api/response";
import { notificationReadSchema } from "@/lib/validations";
import { listNotifications, markNotificationsRead } from "@/lib/services/content-system";

export async function GET() {
  try {
    const user = await requireUser();
    const notifications = await listNotifications(user);
    return successResponse(notifications);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser();
    const input = notificationReadSchema.parse(await request.json());
    const notifications = await markNotificationsRead(user, input.ids);
    return successResponse(notifications, "Notifications marked as read");
  } catch (error) {
    return handleRouteError(error);
  }
}
