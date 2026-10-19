
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawToken = body?.token;

    if (
      typeof rawToken !== "string" ||
      !/^[a-f0-9]{64}$/.test(rawToken)
    ) {
      return NextResponse.json(
        { error: "Invalid link token." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please log in to revoke this link." },
        { status: 401 }
      );
    }

    const tokenHash = createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const admin = createAdminClient();

    const { data: token, error: tokenError } = await admin
      .from("tokens")
      .select("id, engagement_id, revoked_at, purpose")
      .eq("token_hash", tokenHash)
      .eq("purpose", "summary")
      .maybeSingle();

    if (tokenError) {
      console.error("Token lookup failed:", tokenError.message);
      return NextResponse.json(
        { error: "Could not verify the link." },
        { status: 500 }
      );
    }

    if (!token) {
      return NextResponse.json(
        { error: "Link not found." },
        { status: 404 }
      );
    }

    const { data: household, error: householdError } = await admin
      .from("engagements")
      .select("id")
      .eq("id", token.engagement_id)
      .eq("worker_id", user.id)
      .maybeSingle();

    if (householdError) {
      return NextResponse.json(
        { error: "Could not verify household ownership." },
        { status: 500 }
      );
    }

    if (!household) {
      return NextResponse.json(
        { error: "You cannot revoke this link." },
        { status: 403 }
      );
    }

    if (token.revoked_at) {
      return NextResponse.json({
        message: "This link has already been revoked.",
      });
    }

    const { error: updateError } = await admin
      .from("tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", token.id)
      .is("revoked_at", null);

    if (updateError) {
      console.error("Token revocation failed:", updateError.message);
      return NextResponse.json(
        { error: "Could not revoke the link." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Share link revoked successfully.",
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}
