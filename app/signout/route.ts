import { NextResponse, type NextRequest } from "next/server";
import { NAME_COOKIE, SESSION_COOKIE } from "../../lib/session";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(NAME_COOKIE);
  return res;
}
