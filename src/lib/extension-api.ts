import "server-only";
import type { NextRequest } from "next/server";

/** Extension API calls come from a chrome-extension:// origin (or the app itself). */
export const extensionOriginOk = (request: NextRequest) => {
  const origin = request.headers.get("origin") ?? "";
  return !origin || origin.startsWith("chrome-extension://") || origin === new URL(request.url).origin;
};
