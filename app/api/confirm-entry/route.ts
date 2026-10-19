
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const token: unknown = body?.token;
    const decision: unknown = body?.decision;

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token)
    ) {
      return NextResponse.json(
        { error: "Invalid confirmation link." },
        { status: 400 }
      );
    }

    if (
      decision !== "confirmed" &&
      decision !== "contested"
    ) {
      return NextResponse.json(
        { error: "Invalid decision." },
        { status: 400 }
      );
    }

    const tokenHash = createHash("sha256")
      .update(token)
      .digest("hex");

    const admin = createAdminClient();

    const { data, error } = await admin.rpc(
      "resolve_entry_token",
      {
        p_token_hash: tokenHash,
        p_decision: decision,
      }
    );

    if (error) {
      console.error(
        "Confirmation API error:",
        error.message
      );

      return NextResponse.json(
        { error: "Unable to process this record." },
        { status: 500 }
      );
    }

    if (data !== "ok") {
      const messages: Record<string, string> = {
        invalid_token: "This confirmation link is invalid.",
        used_token: "This link has already been used.",
        expired_token: "This confirmation link has expired.",
        record_not_pending:
          "This record has already been resolved.",
        invalid_decision: "Invalid decision.",
      };

      return NextResponse.json(
        {
          error:
            messages[data] ??
            "Unable to process this record.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: decision,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }
}
