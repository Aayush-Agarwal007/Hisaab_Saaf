
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const configuredSecret = process.env.ACCOUNT_RECOVERY_SECRET;
  const suppliedSecret = request.headers.get("x-account-recovery-secret");

  if (
    !configuredSecret ||
    !suppliedSecret ||
    suppliedSecret !== configuredSecret
  ) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const admin = createAdminClient();

    // Only process jobs whose application data was already deleted.
    const { data: jobs, error } = await admin
      .from("account_deletion_jobs")
      .select("user_id")
      .eq("status", "data_deleted")
      .limit(20);

    if (error) {
      console.error("Could not load deletion jobs:", error.message);
      return NextResponse.json(
        { error: "Could not load deletion jobs." },
        { status: 500 }
      );
    }

    let completed = 0;
    let failed = 0;

    for (const job of jobs ?? []) {
      const { error: deleteError } =
        await admin.auth.admin.deleteUser(job.user_id);

      if (deleteError) {
        // Treat the job as complete only if Auth confirms
        // that the user no longer exists.
        const { data, error: lookupError } =
          await admin.auth.admin.getUserById(job.user_id);

        if (lookupError || data.user) {
          failed++;
          console.error(
            "Auth deletion retry failed:",
            deleteError.message
          );
          continue;
        }
      }

      const { error: updateError } = await admin
        .from("account_deletion_jobs")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", job.user_id)
        .eq("status", "data_deleted");

      if (updateError) {
        failed++;
        console.error(
          "Could not complete deletion job:",
          updateError.message
        );
        continue;
      }

      completed++;
    }

    return NextResponse.json({
      success: true,
      processed: jobs?.length ?? 0,
      completed,
      failed,
    });
  } catch (error) {
    console.error("Deletion recovery failed:", error);
    return NextResponse.json(
      { error: "Unexpected recovery error." },
      { status: 500 }
    );
  }
}
