
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    // 1. Verify the worker's authenticated session.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in to delete your account." },
        { status: 401 }
      );
    }

    // 2. Use the admin client only on the server.
      
    // 2. Use the admin client only on the server.
    const admin = createAdminClient();

    const {
      data: authUserData,
      error: authUserCheckError,
    } = await admin.auth.admin.getUserById(user.id);

    if (authUserCheckError || !authUserData.user) {
      console.error(
        "Account deletion Auth check failed:",
        authUserCheckError?.message
      );

      return NextResponse.json(
        { error: "Unable to verify your account for deletion." },
        { status: 500 }
      );
    }

    // 3. Delete the worker's database records transactionally.
    const { error: databaseDeleteError } = await admin.rpc(
      "delete_worker_data",
      { p_worker_id: user.id }
    );

    if (databaseDeleteError) {
      console.error(
        "Account database deletion failed:",
        databaseDeleteError.message
      );

      return NextResponse.json(
        { error: "Unable to delete your records. Please try again." },
        { status: 500 }
      );
    }

    // 4. Delete the Supabase Auth account.
    const { error: authDeleteError } =
      await admin.auth.admin.deleteUser(user.id);

    if (authDeleteError) {
      console.error(
        "Auth account deletion failed after data deletion:",
        authDeleteError.message
      );

      return NextResponse.json(
        {
          error:
            "Your records were deleted, but account closure could not be completed. Please contact support.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Your account and associated records have been deleted.",
    });
  } catch (error) {
    console.error("Account deletion request failed:", error);

    return NextResponse.json(
      { error: "Unexpected error while deleting your account." },
      { status: 500 }
    );
  }
}
