
import { NextResponse } from "next/server";
import { checkRecoveryRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("phone" in body) ||
      typeof body.phone !== "string" ||
      !/^[6-9]\d{9}$/.test(body.phone)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Enter a valid 10-digit mobile number.",
        },
        { status: 400 }
      );
    }

    const rateLimit = checkRecoveryRateLimit(body.phone);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Too many requests. Try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(
              rateLimit.retryAfterSeconds
            ),
          },
        }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          "PIN recovery is unavailable until secure phone verification is configured. No PIN has been changed.",
      },
      { status: 503 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400 }
    );
  }
}
