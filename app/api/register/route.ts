
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const registrationSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  pin: z.string().regex(/^\d{6}$/),
});

export async function POST(request: Request) {
  let createdUserId: string | null = null;

  try {
    const body: unknown = await request.json();
    const parsed = registrationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a valid name, mobile number, and six-digit PIN." },
        { status: 400 }
      );
    }

    const { displayName, phone, pin } = parsed.data;
    const email = `91${phone}@u.hisaabsaaf.app`;
    const admin = createAdminClient();

    // Check whether this phone number already has a profile.
    const { data: existingProfile, error: profileCheckError } =
      await admin
        .from("profiles")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

    if (profileCheckError) {
      console.error("Profile lookup failed:", profileCheckError.message);
      return NextResponse.json(
        { error: "Unable to register right now. Please try again." },
        { status: 500 }
      );
    }

    if (existingProfile) {
      return NextResponse.json(
        { error: "An account with this mobile number already exists." },
        { status: 409 }
      );
    }

    // Create the Auth account.
    const { data: authData, error: authError } =
      await admin.auth.admin.createUser({
        email,
        password: pin,
        email_confirm: true,
      });

    if (authError || !authData.user) {
      if (authError?.code === "email_exists") {
        return NextResponse.json(
          {
            error:
              "An account may already exist for this number. Please contact support.",
          },
          { status: 409 }
        );
      }

      console.error("Auth account creation failed:", authError?.message);
      return NextResponse.json(
        { error: "Unable to create your account. Please try again." },
        { status: 500 }
      );
    }

    createdUserId = authData.user.id;

    // Create the matching worker profile.
    const { error: insertProfileError } = await admin
      .from("profiles")
      .insert({
        id: createdUserId,
        display_name: displayName,
        phone,
      });

    if (insertProfileError) {
      console.error("Profile creation failed:", insertProfileError.message);

      // Roll back the Auth account if its profile cannot be created.
      const { error: rollbackError } =
        await admin.auth.admin.deleteUser(createdUserId);

      if (rollbackError) {
        console.error("Auth rollback failed:", rollbackError.message);
      }

      return NextResponse.json(
        { error: "Unable to finish registration. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Account created. You can now sign in.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration request failed:", error);

    return NextResponse.json(
      { error: "Invalid request or server error." },
      { status: 400 }
    );
  }
}
