
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    // 1. Verify the signed-in worker.
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

    // 2. Delete the worker's database records in one transaction.
    // This uses the authenticated client, not the service-role client.
    const { error: databaseDeleteError } = await supabase.rpc(
      "delete_worker_data",
      { p_worker_id: user.id }
    );

    if (databaseDeleteError) {
      console.error(
        "Account database deletion failed:",
        databaseDeleteError.message
      );

      return NextResponse.json(
        { error: "Unable to delete your data. Please try again." },
        { status: 500 }
      );
    }

    // 3. Delete the Supabase Auth account.
    const admin = createAdminClient();

    const { error: authDeleteError } =
      await admin.auth.admin.deleteUser(user.id);

    if (authDeleteError) {
      console.error(
        "Auth account deletion failed after database cleanup:",
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
