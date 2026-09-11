import { getCurrentContext } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";

export async function GET() {
  const context = await getCurrentContext();
  if (!context) return unauthorized();
  return ok(context);
}