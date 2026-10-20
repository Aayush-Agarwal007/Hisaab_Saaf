
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const configuredSecret = process.env.ACCOUNT_RECOVERY_SECRET;
  const suppliedSecret = request.headers.get("x-account-recovery-secret");

  if (!configuredSecret || !suppliedSecret || suppliedSecret !== configuredSecret) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  try {
    const admin = createAdminClient();

    const { data: jobs, error: jobsError } = await admin
      .from("account_deletion_jobs")
      .select("user_id, status")
      .eq("status", "pending")
      .limit(20);

    if (jobsError) {
      console.error("Could not load deletion jobs:", jobsError.message);
      return NextResponse.json(
        { error: "Could not load pending deletion jobs." },
        { status: 500 }
      );
    }

    let completed = 0;
    let failed = 0;

    for (const job of jobs ?? []) {
      // Auth deletion is safe to retry: a missing Auth user means
      // the account is already gone.
      const { error: deleteError } =
        await admin.auth.admin.deleteUser(job.user_id);

      if (deleteError) {
        const { data: existingUser, error: lookupError } =
          await admin.auth.admin.getUserById(job.user_id);

        if (!lookupError && !existingUser.user) {
          // If the Auth account no longer exists, finish the job.
          const { error: updateError } = await admin
            .from("account_deletion_jobs")
            .update({
              status: "completed",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", job.user_id)
            .eq("status", "pending");

          if (updateError) {
            failed++;
            continue;
          }

          completed++;
          continue;
        }

        failed++;
        console.error(
          "Auth deletion retry failed:",
          deleteError.message
        );
        continue;
      }

      const { error: updateError } = await admin
        .from("account_deletion_jobs")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", job.user_id)
        .eq("status", "pending");

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
