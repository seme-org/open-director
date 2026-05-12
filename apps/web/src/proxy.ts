import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { routing } from "./i18n.config";

const handleI18nRouting = createMiddleware({
  ...routing,
  localeDetection: true,
});

export function proxy(request: NextRequest) {
  if (request.nextUrl.searchParams.has("lang")) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("lang");
    return NextResponse.redirect(url);
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
