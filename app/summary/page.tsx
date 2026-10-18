
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Household = {
  id: string;
  label: string;
  paid_leave_per_month: number | null;
};

type SummaryRow = {
  engagement_id: string;
  month: string;
  leave_used: number | null;
  leave_contested: number | null;
  advance_confirmed: number | null;
  advance_pending: number | null;
  advance_contested: number | null;
};

type Entry = {
  id: string;
  engagement_id: string;
  type: "leave" | "advance" | "payment" | "bonus";
  entry_date: string;
  amount: number | null;
  note: string | null;
  status: "pending" | "confirmed" | "contested";
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100";

const statusStyle: Record<Entry["status"], string> = {
  pending: "bg-amber-50 text-amber-800",
  confirmed: "bg-emerald-50 text-emerald-800",
  contested: "bg-red-50 text-red-800",
};

const statusLabel: Record<Entry["status"], string> = {
  pending: "Awaiting confirmation",
  confirmed: "Confirmed",
  contested: "Disputed",
};

const typeLabel: Record<Entry["type"], string> = {
  leave: "Leave",
  advance: "Advance",
  payment: "Salary / payment",
  bonus: "Bonus",
};

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function formatMonth(value: string) {
  const [year, month] = value.slice(0, 10).split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function formatMoney(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export default function SummaryPage() {
  const router = useRouter();
    const supabase = useMemo(() => createClient(), []);
    

  const [households, setHouseholds] = useState<Household[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [summaryRows, setSummaryRows] = useState<SummaryRow[]>([]);
  const [householdId, setHouseholdId] = useState("");
  const [month, setMonth] = useState("");
  const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    
const [sharing, setSharing] = useState(false);
const [shareError, setShareError] = useState("");
const [shareUrl, setShareUrl] = useState("");
const [whatsappUrl, setWhatsappUrl] = useState("");
const [linkExpiresAt, setLinkExpiresAt] = useState("");


  useEffect(() => {
    setMonth(getCurrentMonth());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: householdData, error: householdError } = await supabase
        .from("engagements")
        .select("id, label, paid_leave_per_month")
        .eq("worker_id", user.id)
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (householdError) {
        setError("Could not load households. Please try again.");
        setLoading(false);
        return;
      }

      const loadedHouseholds = (householdData ?? []) as Household[];
      setHouseholds(loadedHouseholds);

      const selectedId = loadedHouseholds.some((h) => h.id === householdId)
        ? householdId
        : loadedHouseholds[0]?.id ?? "";

      setHouseholdId(selectedId);

      if (!selectedId || !month) {
        setEntries([]);
        setSummaryRows([]);
        setLoading(false);
        return;
      }

      const firstDay = month.slice(0, 10);
      const [year, monthNumber] = firstDay.split("-").map(Number);
      const nextMonth = `${monthNumber === 12 ? year + 1 : year}-${String(
        monthNumber === 12 ? 1 : monthNumber + 1
      ).padStart(2, "0")}-01`;

      const [summaryResult, entriesResult] = await Promise.all([
        supabase
          .from("month_summary")
          .select(
            "engagement_id, month, leave_used, leave_contested, advance_confirmed, advance_pending, advance_contested"
          )
          .eq("engagement_id", selectedId)
          .eq("month", firstDay),
        supabase
          .from("entries")
          .select("id, engagement_id, type, entry_date, amount, note, status")
          .eq("engagement_id", selectedId)
          .gte("entry_date", firstDay)
          .lt("entry_date", nextMonth)
          .order("entry_date", { ascending: false }),
      ]);

      if (cancelled) return;

      if (summaryResult.error || entriesResult.error) {
        console.error("Monthly summary load error:", {
          summary: summaryResult.error,
          entries: entriesResult.error,
        });

        setError(
          "Could not load the monthly summary. Check the month_summary view and entries SELECT policy."
        );
      } else {
        setSummaryRows((summaryResult.data ?? []) as SummaryRow[]);
        setEntries((entriesResult.data ?? []) as Entry[]);
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [supabase, router, householdId, month]);

  const selectedHousehold = households.find((h) => h.id === householdId);

  const summary = summaryRows.find(
    (row) =>
      row.engagement_id === householdId &&
      row.month.slice(0, 10) === month.slice(0, 10)
  );

  const leaveQuota = Number(selectedHousehold?.paid_leave_per_month ?? 0);

  const leaveUsed = Number(summary?.leave_used ?? 0);
  const leaveContested = Number(summary?.leave_contested ?? 0);

  const confirmedAdvances = Number(summary?.advance_confirmed ?? 0);
  const pendingAdvances = Number(summary?.advance_pending ?? 0);
  const contestedAdvances = Number(summary?.advance_contested ?? 0);

  const advanceEntries = entries.filter((entry) => entry.type === "advance");

  const totalForStatus = (status: Entry["status"]) =>
    advanceEntries
      .filter((entry) => entry.status === status)
      .reduce((total, entry) => total + Number(entry.amount ?? 0), 0);

  const confirmedAdvanceAmount = totalForStatus("confirmed");
  const pendingAdvanceAmount = totalForStatus("pending");
  const contestedAdvanceAmount = totalForStatus("contested");

  const leaveEntries = entries.filter((entry) => entry.type === "leave");

  function changeMonth(offset: number) {
    const [year, monthNumber] = month.slice(0, 10).split("-").map(Number);
    const date = new Date(year, monthNumber - 1 + offset, 1);

    setMonth(
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`
    );
  }

async function handleShareSummary() {
  setSharing(true);
  setShareError("");
  setShareUrl("");
  setWhatsappUrl("");
  setLinkExpiresAt("");

  try {
    const response = await fetch("/api/summary-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engagementId: householdId,
        month: month.slice(0, 7),
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not generate the link.");
    }

    setShareUrl(result.summaryUrl);
    setWhatsappUrl(result.whatsappUrl);
    setLinkExpiresAt(result.expiresAt);
  } catch (error) {
    setShareError(
      error instanceof Error ? error.message : "Something went wrong."
    );
  } finally {
    setSharing(false);
  }
}

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <button
            type="button"
            onClick={() => router.push("/records")}
            className="mb-4 text-sm font-medium text-emerald-700 hover:underline"
          >
            ← Back to records
          </button>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Monthly summary
          </h1>

<section className="rounded-2xl border border-emerald-200 bg-white p-5">
  <h2 className="text-lg font-bold text-slate-900">
    Share monthly statement
  </h2>

  <p className="mt-1 text-sm text-slate-600">
    Generate a read-only link for this household and month.
    The link expires after seven days.
  </p>

  <button
    type="button"
    onClick={handleShareSummary}
    disabled={sharing || loading || !householdId || !month}
    className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
  >
    {sharing ? "Generating link..." : "Generate share link"}
  </button>

  {shareError && (
    <p role="alert" className="mt-3 text-sm text-red-700">
      {shareError}
    </p>
  )}

  {shareUrl && (
    <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
      <p className="break-all text-sm text-slate-700">{shareUrl}</p>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white"
      >
        Share via WhatsApp
      </a>

      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(shareUrl);
            setShareError("");
          } catch {
            setShareError("Copy failed. Please copy the link manually.");
          }
        }}
        className="ml-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
      >
        Copy link
      </button>

      {linkExpiresAt && (
        <p className="text-xs text-slate-500">
          Expires: {new Date(linkExpiresAt).toLocaleString("en-IN")}
        </p>
      )}
    </div>
  )}
</section>

          <p className="mt-2 text-slate-600">
            A clear record of leave and advances for each household.
          </p>
        </header>

        <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="household"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Household
            </label>

            <select
              id="household"
              className={inputClass}
              value={householdId}
              onChange={(event) => setHouseholdId(event.target.value)}
            >
              <option value="">Select household</option>
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="month"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Month
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                disabled={!month}
                aria-label="Previous month"
                className="rounded-xl border border-slate-200 px-4 text-slate-700 hover:bg-slate-50"
              >
                ←
              </button>

              <input
                id="month"
                type="month"
                value={month.slice(0, 7)}
                onChange={(event) =>
                  setMonth(event.target.value ? `${event.target.value}-01` : "")
                }
                className={inputClass}
              />

              <button
                type="button"
                onClick={() => changeMonth(1)}
                disabled={!month}
                aria-label="Next month"
                className="rounded-xl border border-slate-200 px-4 text-slate-700 hover:bg-slate-50"
              >
                →
              </button>
            </div>
          </div>
        </section>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500">
            Loading monthly summary…
          </div>
        ) : households.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="font-semibold text-slate-900">No households yet</p>
            <p className="mt-2 text-sm text-slate-600">
              Add a household before creating a monthly summary.
            </p>
            <button
              type="button"
              onClick={() => router.push("/engagements")}
              className="mt-4 rounded-xl bg-emerald-600 px-4 py-2.5 font-semibold text-white"
            >
              Add household
            </button>
          </section>
        ) : (
          <>
            <section className="rounded-2xl bg-slate-900 p-6 text-white">
              <p className="text-sm text-slate-300">
                {selectedHousehold?.label ?? "Household"} ·{" "}
                {month ? formatMonth(month) : ""}
              </p>

              <h2 className="mt-4 text-2xl font-bold">Leave overview</h2>

              <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-300">Leave used</p>
                  <p className="mt-1 text-4xl font-bold">
                    {leaveUsed}
                    <span className="ml-2 text-lg font-medium text-slate-300">
                      / {leaveQuota} days
                    </span>
                  </p>
                </div>

                <p className="text-sm text-slate-300">
                  {leaveContested} disputed
                </p>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
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

              <p className="mt-2 text-xs text-slate-300">
                Leave totals follow the database summary. Check each status
                below before treating a disputed entry as agreed.
              </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm font-medium text-emerald-800">
                  Confirmed advances
                </p>
                <p className="mt-2 text-2xl font-bold text-emerald-900">
                  {formatMoney(confirmedAdvanceAmount)}
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  {confirmedAdvances} records
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <p className="text-sm font-medium text-amber-800">
                  Pending advances
                </p>
                <p className="mt-2 text-2xl font-bold text-amber-900">
                  {formatMoney(pendingAdvanceAmount)}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  {pendingAdvances} records awaiting review
                </p>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                <p className="text-sm font-medium text-red-800">
                  Disputed advances
                </p>
                <p className="mt-2 text-2xl font-bold text-red-900">
                  {formatMoney(contestedAdvanceAmount)}
                </p>
                <p className="mt-1 text-xs text-red-700">
                  {contestedAdvances} disputed records
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">
                Leave dates
              </h2>

              {leaveEntries.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                  No leave records for this month.
                </div>
              ) : (
                leaveEntries.map((entry) => (
                  <article
                    key={entry.id}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {new Date(
                          `${entry.entry_date}T00:00:00`
                        ).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>

                      {entry.note && (
                        <p className="mt-1 text-sm text-slate-600">
                          {entry.note}
                        </p>
                      )}
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[entry.status]}`}
                    >
                      {statusLabel[entry.status]}
                    </span>
                  </article>
                ))
              )}
            </section>

            <section className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900">
                Advance and payment history
              </h2>

              {entries.filter((entry) => entry.type !== "leave").length ===
              0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                  No advances, payments, or bonuses for this month.
                </div>
              ) : (
                entries
                  .filter((entry) => entry.type !== "leave")
                  .map((entry) => (
                    <article
                      key={entry.id}
                      className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">
                          {typeLabel[entry.type]}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {new Date(
                            `${entry.entry_date}T00:00:00`
                          ).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        {entry.note && (
                          <p className="mt-1 text-sm text-slate-600">
                            {entry.note}
                          </p>
                        )}
                        <span
                          className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle[entry.status]}`}
                        >
                          {statusLabel[entry.status]}
                        </span>
                      </div>

                      <p className="shrink-0 font-bold text-slate-900">
                        {formatMoney(Number(entry.amount ?? 0))}
                      </p>
                    </article>
                  ))
              )}
            </section>

            <p className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500">
              Hisaab Saaf records are informal memory aids, not legal
              documents or wage calculations. Disputed entries are clearly
              marked and should not be treated as mutually agreed.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
