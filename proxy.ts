import { NextResponse, type NextRequest } from "next/server";
import { isSignedIn, SESSION_COOKIE } from "./lib/session";

// Every page except the sign-in form needs the shared password cookie.
export async function proxy(req: NextRequest) {
  if (!process.env.FACT_PACK_PASSWORD) {
    return new NextResponse("Fact pack password is not configured.", { status: 503 });
  }
  if (await isSignedIn(req.cookies.get(SESSION_COOKIE)?.value)) {
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
