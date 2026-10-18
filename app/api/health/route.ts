
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("profiles")
      .select("id")
      .limit(1);

    if (error) {
      console.error("Supabase health check failed:", error.message);

      return NextResponse.json(
        { ok: false, db: "error" },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, db: "up" });
  } catch (error) {
    console.error("Health check failed:", error);

    return NextResponse.json(
      { ok: false, db: "error" },
      { status: 503 }
    );
  }
}
