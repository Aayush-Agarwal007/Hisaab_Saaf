
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ConsentPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleContinue() {
    if (!accepted) {
      setError("Please accept the consent notice to continue.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { user }, error: authError } =
        await supabase.auth.getUser();

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-lg space-y-6 rounded-3xl bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-slate-900">
          Welcome to Hisaab Saaf
        </h1>

        <p className="text-slate-600">
          Your work, your records, your control.
        </p>

        <div className="space-y-3 rounded-xl bg-emerald-50 p-5 text-slate-700">
          <h2 className="font-semibold">Your consent matters</h2>
          <p>
            Hisaab Saaf helps you maintain records of work, leave,
            advances and payments.
          </p>
          <p>
            Your information will be used to provide these services.
            You can ask questions about your records or request help
            managing your information.
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            I have read and understood this notice, and I agree to
            the use of my information to maintain my work records.
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
      </section>
    </main>
  );
}
