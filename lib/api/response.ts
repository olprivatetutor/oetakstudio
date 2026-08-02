import { NextResponse } from "next/server";
import { ZodError } from "zod";

type ErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export function successResponse<T>(
  data: T,
  message = "Operation completed successfully",
  init?: ResponseInit,
) {
  return NextResponse.json(
    {
      success: true,
      data,
      message,
    },
    init,
  );
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
    },
    { status },
  );
}

export function validationErrorResponse(error: ZodError) {
  return errorResponse(
    "VALIDATION_ERROR",
    "Invalid request data",
    400,
    error.flatten(),
  );
}

export function handleRouteError(error: unknown) {
  if (error instanceof ZodError) {
    return validationErrorResponse(error);
  }

  if (error instanceof AppError) {
    return errorResponse(error.code, error.message, error.status, error.details);
  }

  console.error(error);
  return errorResponse("INTERNAL_ERROR", "Something went wrong", 500);
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}
