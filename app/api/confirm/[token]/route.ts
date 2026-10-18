
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return new NextResponse("Invalid confirmation link.", { status: 400 });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("tokens")
    .select("id, purpose, entry_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .eq("purpose", "entry")
    .maybeSingle();

  if (error || !data) {
    return new NextResponse("Invalid or expired confirmation link.", {
      status: 404,
    });
  }

  if (data.used_at || new Date(data.expires_at) < new Date()) {
    return new NextResponse("This confirmation link has expired or was already used.", {
      status: 410,
    });
  }

  // For now, show a safe preview. The next step adds Confirm/Dispute buttons.
  return new NextResponse(
    `Hisaab Saaf confirmation link is valid.\nRecord ID: ${data.entry_id}\n\nToken validation succeeded. No record has been changed.`,
    {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }
  );
}
