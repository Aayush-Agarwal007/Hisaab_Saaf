"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ConsentPage() {
  const router = useRouter();

  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [signedIn, setSignedIn] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkUser() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (active) {
        setSignedIn(Boolean(user));
      }
    }

    void checkUser();

    return () => {
      active = false;
    };
  }, []);

  async function handleContinue() {
    if (!accepted) {
      setError("Please accept the consent notice to continue.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ consented_at: new Date().toISOString() })
        .eq("id", user.id);

      if (updateError) {
        setError("Could not save your consent. Please try again.");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount() {
    const confirmation = window.confirm(
      "Permanently delete your Hisaab Saaf account and associated records? This cannot be undone.",
    );

    if (!confirmation) return;

    const finalConfirmation = window.prompt(
      "Type DELETE to confirm permanent account deletion.",
    );

    if (finalConfirmation !== "DELETE") {
      setDeleteError("Deletion cancelled. Your account has not been deleted.");
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
      });

      const result: { success?: boolean; error?: string } =
        await response.json();

      if (!response.ok || !result.success) {
        setDeleteError(
          result.error ?? "Account deletion failed. Please contact support.",
        );
        return;
      }

      const supabase = createClient();
      await supabase.auth.signOut();

      router.replace("/login?accountDeleted=1");
      router.refresh();
    } catch {
      setDeleteError(
        "Unable to complete the request. Please check your connection and contact support if needed.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-lg space-y-6 rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-slate-900">
          Welcome to Hisaab Saaf
        </h1>

        <p className="text-slate-600">Your work, your records, your control.</p>

        <div className="space-y-3 rounded-xl bg-emerald-50 p-5 text-slate-700">
          <h2 className="font-semibold">Your consent matters</h2>
          <p>
            Hisaab Saaf helps you maintain records of work, leave, advances and
            payments.
          </p>
          <p>
            Your information will be used to provide these services. You can ask
            questions about your records or request help managing your
            information.
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(event) => setAccepted(event.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            I have read and understood this notice, and I agree to the use of my
            information to maintain my work records.
          </span>
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          onClick={handleContinue}
          disabled={loading || !accepted}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Please wait..." : "I agree and continue"}
        </button>

        {signedIn && (
          <section className="space-y-3 border-t border-red-200 pt-6">
            <h2 className="font-semibold text-red-700">Delete account</h2>

            <p className="text-sm leading-6 text-slate-600">
              Permanently delete your account and associated work records. This
              action cannot be undone.
            </p>

            {deleteError && (
              <p role="alert" className="text-sm text-red-600">
                {deleteError}
              </p>
            )}

            <button
              type="button"
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="w-full rounded-xl border border-red-300 px-4 py-3 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {deleting ? "Deleting account..." : "Delete my account"}
            </button>
          </section>
        )}
      </section>
    </main>
  );
}
