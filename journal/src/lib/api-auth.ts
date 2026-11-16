import { safeEqual } from "./auth";

/** Bearer-token check for the external API. Disabled entirely when CAPTURE_TOKEN is unset. */
export function apiAuthorized(req: Request): boolean {
  const token = process.env.CAPTURE_TOKEN;
  if (!token) return false;
  const header = req.headers.get("authorization") ?? "";
  const given = header.replace(/^Bearer\s+/i, "");
  return !!given && safeEqual(given, token);
}

export const unauthorized = () =>
  Response.json({ error: "Unauthorized. Send Authorization: Bearer <CAPTURE_TOKEN>." }, { status: 401 });
