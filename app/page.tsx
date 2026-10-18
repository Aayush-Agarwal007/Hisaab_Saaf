import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function DashboardPage() {
  await connection();

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, phone, consented_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) {
    if (error) {
      console.error("Profile load failed:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <section className="max-w-md rounded-2xl bg-white p-6 shadow">
          <h1 className="text-xl font-bold text-slate-900">
            Profile not found
          </h1>
          <p className="mt-2 text-slate-600">
            Your profile could not be loaded. Please check your profile record
            in Supabase.
          </p>
        </section>
      </main>
    );
  }

  if (!profile.consented_at) {
    redirect("/consent");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-5 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <p className="font-semibold text-emerald-600">Hisaab Saaf</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Namaste, {profile.display_name || "Dost"}!
          </h1>
          <p className="mt-2 text-slate-600">
            Aapka kaam, aapka hisaab.
          </p>
        </header>

        <section>
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            Your records
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800">
                Leave records
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Keep track of your leave days.
              </p>
              <p className="mt-4 text-sm text-slate-400">
                Coming next
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-slate-800">
                Advance records
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Track advances and payments.
              </p>
              <p className="mt-4 text-sm text-slate-400">
                Coming next
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Your account</h2>
          <p className="mt-2 text-sm text-slate-600">
            Mobile: {profile.phone || "Not added"}
          </p>
        </section>
      </div>
    </main>
  );
}