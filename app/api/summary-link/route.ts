
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const engagementId = body?.engagementId;
    const month = body?.month;

    if (
      typeof engagementId !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(engagementId)
    ) {
      return NextResponse.json(
        { error: "Invalid household." },
        { status: 400 }
      );
    }

    if (
      typeof month !== "string" ||
      !/^\d{4}-\d{2}$/.test(month)
    ) {
      return NextResponse.json(
        { error: "Choose a valid month." },
        { status: 400 }
      );
    }

    const [year, monthNumber] = month.split("-").map(Number);

    if (
      monthNumber < 1 ||
      monthNumber > 12 ||
      year < 2000 ||
      year > 2100
    ) {
      return NextResponse.json(
        { error: "Choose a valid month." },
        { status: 400 }
      );
    }

    // Verify the signed-in worker owns this household.
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in again." },
        { status: 401 }
      );
    }

    const { data: household, error: householdError } = await supabase
      .from("engagements")
      .select("id, label")
      .eq("id", engagementId)
      .eq("worker_id", user.id)
      .eq("active", true)
      .maybeSingle();

    if (householdError || !household) {
      return NextResponse.json(
        { error: "Household not found or access denied." },
        { status: 404 }
      );
    }

    // Store only the SHA-256 hash, never the raw secret.
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256")
      .update(rawToken)
      .digest("hex");

    const monthDate = `${month}-01`;
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000
    ).toISOString();

    const admin = createAdminClient();

    const { error: insertError } = await admin.from("tokens").insert({
      token_hash: tokenHash,
      purpose: "summary",
      entry_id: null,
      engagement_id: household.id,
      month: monthDate,
      expires_at: expiresAt,
    });

    if (insertError) {
      console.error("Summary token creation failed:", insertError.message);

      return NextResponse.json(
        { error: "Could not create the share link." },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!baseUrl) {
      return NextResponse.json(
        { error: "Application URL is not configured." },
        { status: 500 }
      );
    }

    const summaryUrl =
      `${baseUrl.replace(/\/$/, "")}/shared-summary/${rawToken}`;

    const message =
      `Hisaab Saaf monthly summary for ${household.label} (${month}). ` +
      `View the read-only statement here: ${summaryUrl}`;

    const whatsappUrl =
      `https://wa.me/?text=${encodeURIComponent(message)}`;

    return NextResponse.json({
      summaryUrl,
      whatsappUrl,
      expiresAt,
    });
  } catch (error) {
    console.error("Summary-link API failed:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}
