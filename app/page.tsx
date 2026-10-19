
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
            Your profile could not be loaded. Please check your profile
            record in Supabase.
          </p>
        </section>
      </main>
    );
  }

  if (!profile.consented_at) {
    redirect("/consent");
  }

  const navigationCards = [
    {
      title: "Households",
      description: "Add and manage the homes where you work.",
      detail: "Manage employers and weekly holidays",
      href: "/engagements",
      icon: "🏠",
      action: "Manage households",
    },
    {
      title: "Records",
      description: "Record leave days, advances, payments and bonuses.",
      detail: "View your entries and their confirmation status",
      href: "/records",
      icon: "📒",
      action: "Open records",
    },
    {
      title: "Monthly summary",
      description: "Review your monthly work and payment records.",
      detail: "View and share your monthly statement",
      href: "/summary",
      icon: "📊",
      action: "View summary",
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-5 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-emerald-600">
              Hisaab Saaf
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Namaste, {profile.display_name || "Dost"}!
            </h1>
            <p className="mt-2 text-slate-600">
              Aapka kaam, aapka hisaab.
            </p>
          </div>

          <Link
            href="/consent"
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Account & consent
          </Link>
        </header>

        <section>
          <div className="mb-4">
            <h2 className="text-xl font-bold text-slate-900">
              Your Hisaab
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose what you want to do.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {navigationCards.map((card) => (
              <Link
                key={card.title}
                href={card.href}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {card.description}
                    </p>
                  </div>
                  <span className="text-2xl" aria-hidden="true">
                    {card.icon}
                  </span>
                </div>

                <p className="mt-4 text-sm text-slate-500">
                  {card.detail}
                </p>

                <p className="mt-5 font-semibold text-emerald-700 group-hover:text-emerald-800">
                  {card.action} →
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">
            Your account
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Mobile: {profile.phone || "Not added"}
          </p>
          <p className="mt-3 text-sm text-slate-500">
            Your records help you and your employer keep a clear,
            shared account of leave and advances.
          </p>
        </section>

        <footer className="border-t border-slate-200 pt-4 text-center text-xs text-slate-500">
          Hisaab Saaf · Aapka kaam, aapka hisaab.
        </footer>
      </div>
    </main>
  );
}
