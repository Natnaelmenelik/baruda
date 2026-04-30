#!/bin/bash
set -e

echo "Updating middleware for /register protection..."

cat > middleware.ts <<'EOF'
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "change-this-secret",
);

function isAdminUser(user: any) {
  return Boolean(
    user?.isAdmin === true ||
    user?.is_admin === true ||
    user?.role === "admin" ||
    user?.role === "ADMIN",
  );
}

async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, SECRET);
  return payload as any;
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const path = req.nextUrl.pathname;

  const isLoginRoute = path === "/login";
  const isRegisterRoute = path === "/register";
  const isAdminRoute = path.startsWith("/admin");
  const isDashboardRoute = path.startsWith("/dashboard");

  if (!token || token === "null" || token === "undefined") {
    if (isAdminRoute || isDashboardRoute) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect", path);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  try {
    const user = await verifyToken(token);
    const admin = isAdminUser(user);

    // logged-in users should not see login/register
    if (isLoginRoute || isRegisterRoute) {
      return NextResponse.redirect(
        new URL(admin ? "/admin" : "/dashboard", req.url),
      );
    }

    // admin should not access user dashboard
    if (isDashboardRoute && admin) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    // normal users should not access admin
    if (isAdminRoute && !admin) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("token");
    return res;
  }
}

export const config = {
  matcher: ["/login", "/register", "/admin/:path*", "/dashboard/:path*"],
};
EOF

echo "✅ Middleware updated"
echo "Restart:"
echo "npm run dev"