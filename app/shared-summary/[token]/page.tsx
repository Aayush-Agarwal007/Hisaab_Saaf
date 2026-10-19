
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const instant = false;

type Props = {
  params: Promise<{ token: string }>;
};

function Unavailable({ expired = false }: { expired?: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="font-semibold text-emerald-700">Hisaab Saaf</p>
        <h1 className="mt-3 text-2xl font-bold text-slate-900">
          {expired ? "Link expired" : "Summary unavailable"}
        </h1>
        <p className="mt-3 text-slate-600">
          {expired
            ? "This sharing link has expired. Please ask the worker for a new link."
            : "This link is invalid or unavailable. Please ask the worker to generate a new one."}
        </p>
      </section>
    </main>
  );
}

export default async function SharedSummaryPage({ params }: Props) {
  const { token } = await params;

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return <Unavailable />;
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();

  const { data: tokenRecord, error: tokenError } = await admin
    .from("tokens")
    //.select("id, engagement_id, month, expires_at, used_at")
    .select("id, engagement_id, month, expires_at, used_at, revoked_at")
    .eq("token_hash", tokenHash)
    .eq("purpose", "summary")
    .maybeSingle();

  if (tokenError) {
    console.error("Shared summary token lookup failed:", tokenError.message);
    return <Unavailable />;
  }

  if (
  !tokenRecord ||
  tokenRecord.used_at ||
  tokenRecord.revoked_at
) {
  return <Unavailable />;
}

  if (new Date(tokenRecord.expires_at).getTime() <= Date.now()) {
    return <Unavailable expired />;
  }

  if (!tokenRecord.month) {
    return <Unavailable />;
  }

  const month = String(tokenRecord.month).slice(0, 10);
  const [year, monthNumber] = month.split("-").map(Number);
  const nextMonth = `${monthNumber === 12 ? year + 1 : year}-${String(
    monthNumber === 12 ? 1 : monthNumber + 1
  ).padStart(2, "0")}-01`;

  const [householdResult, summaryResult, entriesResult] = await Promise.all([
    admin
      .from("engagements")
      .select("label, paid_leave_per_month")
      .eq("id", tokenRecord.engagement_id)
      .maybeSingle(),
    admin
      .from("month_summary")
      .select(
        "engagement_id, month, leave_used, leave_contested, advance_confirmed, advance_pending, advance_contested"
      )
      .eq("engagement_id", tokenRecord.engagement_id)
      .eq("month", month),
    admin
      .from("entries")
      .select("id, type, entry_date, amount, note, status")
      .eq("engagement_id", tokenRecord.engagement_id)
      .gte("entry_date", month)
      .lt("entry_date", nextMonth)
      .order("entry_date", { ascending: false }),
  ]);

  if (
    householdResult.error ||
    summaryResult.error ||
    entriesResult.error ||
    !householdResult.data
  ) {
    console.error("Shared summary data lookup failed");
    return <Unavailable />;
  }

  const household = householdResult.data;
  const summary = summaryResult.data?.[0];

  const entries = entriesResult.data ?? [];
  const leaveEntries = entries.filter((entry) => entry.type === "leave");
  const advanceEntries = entries.filter((entry) => entry.type === "advance");

  const sumAdvances = (status: string) =>
    advanceEntries
      .filter((entry) => entry.status === status)
      .reduce((total, entry) => total + Number(entry.amount ?? 0), 0);

  const leaveQuota = Number(household.paid_leave_per_month ?? 0);
  const leaveUsed = Number(summary?.leave_used ?? 0);

  const money = (value: number) =>
    `₹${value.toLocaleString("en-IN")}`;

  const displayMonth = new Date(`${month}T00:00:00`).toLocaleDateString(
    "en-IN",
    { month: "long", year: "numeric" }
  );

  const statusLabels: Record<string, string> = {
    pending: "Awaiting confirmation",
    confirmed: "Confirmed",
    contested: "Disputed",
  };

  const statusStyles: Record<string, string> = {
    pending: "bg-amber-50 text-amber-800",
    confirmed: "bg-emerald-50 text-emerald-800",
    contested: "bg-red-50 text-red-800",
  };

  const typeLabels: Record<string, string> = {
    leave: "Leave",
    advance: "Advance",
    payment: "Salary / payment",
    bonus: "Bonus",
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Hisaab Saaf
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Monthly statement
          </h1>
          <p className="mt-2 text-slate-600">{household.label}</p>
          <p className="text-sm text-slate-500">{displayMonth}</p>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            Read-only statement. This page does not allow changes to records.
          </p>
        </header>

        <section className="rounded-2xl bg-slate-900 p-6 text-white">
          <p className="text-sm text-slate-300">Leave used</p>
          <p className="mt-2 text-3xl font-bold">
            {leaveUsed} / {leaveQuota} days
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{
                width: `${
                  leaveQuota > 0
                    ? Math.min(100, (leaveUsed / leaveQuota) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Confirmed advances",
              amount: sumAdvances("confirmed"),
              style: "bg-emerald-50 text-emerald-900",
            },
            {
              title: "Pending advances",
              amount: sumAdvances("pending"),
              style: "bg-amber-50 text-amber-900",
            },
            {
              title: "Disputed advances",
              amount: sumAdvances("contested"),
              style: "bg-red-50 text-red-900",
            },
          ].map((item) => (
            <div
              key={item.title}
              className={`rounded-2xl p-5 ${item.style}`}
            >
              <p className="text-sm">{item.title}</p>
              <p className="mt-2 text-2xl font-bold">{money(item.amount)}</p>
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-slate-900">Monthly records</h2>

          {entries.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-slate-600">
              No records for this month.
            </div>
          ) : (
            entries.map((entry) => (
              <article
                key={entry.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {typeLabels[entry.type] ?? entry.type}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(
                        `${entry.entry_date}T00:00:00`
                      ).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  {entry.amount !== null && (
                    <p className="font-bold text-slate-900">
                      {money(Number(entry.amount))}
                    </p>
                  )}
                </div>

                {entry.note && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {entry.note}
                  </p>
                )}

                <span
                  className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                    statusStyles[entry.status] ??
                    "bg-slate-100 text-slate-700"
                  }`}
                >
                  {statusLabels[entry.status] ?? entry.status}
                </span>
              </article>
            ))
          )}
        </section>

        <p className="text-xs leading-5 text-slate-500">
          This statement is an informal record for reference, not a legal
          document or wage calculation.
        </p>
      </div>
    </main>
  );
}
