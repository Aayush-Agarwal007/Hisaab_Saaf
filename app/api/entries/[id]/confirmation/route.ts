
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: entryId } = await context.params;

    const { data: entry, error: entryError } = await supabase
      .from("entries")
      .select("id, engagement_id, status")
      .eq("id", entryId)
      .maybeSingle();

    if (entryError || !entry) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    if (entry.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending records can be shared." },
        { status: 409 }
      );
    }

    const admin = createAdminClient();

    const { data: household, error: householdError } = await admin
      .from("engagements")
      .select("id, worker_id, employer_phone")
      .eq("id", entry.engagement_id)
      .eq("worker_id", user.id)
      .maybeSingle();

    if (householdError || !household) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    if (!household.employer_phone) {
      return NextResponse.json(
        { error: "Add an employer phone number first." },
        { status: 400 }
      );
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: tokenError } = await admin.from("tokens").insert({
      token_hash: tokenHash,
      purpose: "entry",
      entry_id: entry.id,
      engagement_id: entry.engagement_id,
      expires_at: expiresAt,
    });

    if (tokenError) {
      console.error("Token creation failed:", tokenError.message);
      return NextResponse.json(
        { error: "Could not create confirmation link." },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    //const confirmationUrl = `${baseUrl}/api/confirm/${rawToken}`;
    const confirmationUrl = `${baseUrl}/confirmation/${rawToken}`;
    const message = [
      "Namaste! Please review this work record in Hisaab Saaf.",
      confirmationUrl,
      "This link expires in 7 days.",
    ].join("\n");

    const whatsappUrl =
      `https://wa.me/91${household.employer_phone.replace(/\D/g, "").replace(/^91/, "")}` +
      `?text=${encodeURIComponent(message)}`;

    return NextResponse.json({ confirmationUrl, whatsappUrl });
  } catch (error) {
    console.error("Create confirmation link failed:", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
