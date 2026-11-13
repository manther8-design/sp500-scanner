import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const publicPaths = ["/login", "/api/auth/login", "/api/health"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("erp_session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret");
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "جلسة غير صالحة" }, { status: 401 });
    }
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete("erp_session");
    return res;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
