"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Household = {
  id: string;
  label: string;
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

const TYPE_OPTIONS: {
  value: Entry["type"];
  label: string;
  hint: string;
  tile: string;
  chip: string;
}[] = [
  {
    value: "leave",
    label: "Leave",
    hint: "A day off",
    tile: "bg-sky-100 text-sky-800",
    chip: "border-sky-600 bg-sky-600 text-white",
  },
  {
    value: "advance",
    label: "Advance",
    hint: "Money taken early",
    tile: "bg-amber-100 text-amber-800",
    chip: "border-amber-600 bg-amber-600 text-white",
  },
  {
    value: "payment",
    label: "Salary",
    hint: "Payment received",
    tile: "bg-emerald-100 text-emerald-800",
    chip: "border-emerald-600 bg-emerald-600 text-white",
  },
  {
    value: "bonus",
    label: "Bonus",
    hint: "Extra money received",
    tile: "bg-violet-100 text-violet-800",
    chip: "border-violet-600 bg-violet-600 text-white",
  },
];

const STATUS_STYLES: Record<Entry["status"], string> = {
  pending: "bg-amber-50 text-amber-800",
  confirmed: "bg-emerald-50 text-emerald-700",
  contested: "bg-red-50 text-red-700",
};

const STATUS_LABELS: Record<Entry["status"], string> = {
  pending: "Waiting for employer",
  confirmed: "Confirmed",
  contested: "Disputed",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 transition focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100";

function typeMeta(type: Entry["type"]) {
  return TYPE_OPTIONS.find((o) => o.value === type) ?? TYPE_OPTIONS[0];
}

// Parse "YYYY-MM-DD" manually so dates never shift with timezones.
function parseDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatMoney(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export default function RecordsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [households, setHouseholds] = useState<Household[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [householdId, setHouseholdId] = useState("");
  const [type, setType] = useState<Entry["type"]>("leave");
    //const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchEntries = useCallback(async () => {
    const { data, error: entryError } = await supabase
      .from("entries")
      .select("id, engagement_id, type, entry_date, amount, note, status")
      .order("entry_date", { ascending: false });

    return { data: (data ?? []) as Entry[], error: entryError };
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
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
        .select("id, label")
        .eq("worker_id", user.id)
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (householdError) {
        console.error("Households load failed:", householdError);
        setError("Could not load households.");
        setLoading(false);
        return;
      }

      setHouseholds((householdData ?? []) as Household[]);

      if (householdData?.length) {
        setHouseholdId(householdData[0].id);
      }

      const { data: entryData, error: entryError } = await fetchEntries();

      if (cancelled) return;

      if (entryError) {
        console.error("Entries load failed:", entryError);
        setError("Could not load records. Check the entries SELECT policy.");
      } else {
        setEntries(entryData);
      }

      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [supabase, router, fetchEntries]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!householdId) {
      setError("Please add a household first.");
      return;
    }

    if (!date) {
      setError("Please select a date.");
      return;
    }

    if (
      type !== "leave" &&
      (!amount || !Number.isFinite(Number(amount)) || Number(amount) <= 0)
    ) {
      setError("Enter an amount greater than zero.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { error: insertError } = await supabase.from("entries").insert({
        engagement_id: householdId,
        type,
        entry_date: date,
        amount: type === "leave" ? null : Number(amount),
        note: note.trim() || null,
        status: "pending",
        created_by: "worker",
      });

      if (insertError) {
        console.error("Save record failed:", {
          code: insertError.code,
          message: insertError.message,
          details: insertError.details,
          hint: insertError.hint,
        });
        setError(`Save failed: ${insertError.message}`);
        return;
      }

      setAmount("");
      setNote("");
      setSuccess("Record saved. Your employer can now confirm it.");

      const { data: entryData, error: reloadError } = await fetchEntries();

      if (reloadError) {
        console.error("Reload records failed:", reloadError);
      } else {
        setEntries(entryData);
      }
    } catch (caughtError) {
      console.error("Unexpected record error:", caughtError);
      setError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const visibleEntries = useMemo(
    () =>
      entries.filter((entry) =>
        households.some((household) => household.id === entry.engagement_id)
      ),
    [entries, households]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const entry of visibleEntries) {
      const key = monthKey(entry.entry_date);
      map.set(key, [...(map.get(key) ?? []), entry]);
    }
    return Array.from(map.entries());
  }, [visibleEntries]);

  const thisMonth = useMemo(() => {
    const key = new Date().toLocaleDateString("en-CA").slice(0, 7);
    const monthEntries = visibleEntries.filter(
      (e) => monthKey(e.entry_date) === key
    );
    const sum = (types: Entry["type"][]) =>
      monthEntries
        .filter((e) => types.includes(e.type))
        .reduce((total, e) => total + Number(e.amount ?? 0), 0);

    return {
      label: monthLabel(key),
      leave: monthEntries.filter((e) => e.type === "leave").length,
      advances: sum(["advance"]),
      received: sum(["payment", "bonus"]),
    };
  }, [visibleEntries]);

  function householdName(id: string) {
    return (
      households.find((household) => household.id === id)?.label ?? "Household"
    );
  }

  const noHouseholds = !loading && households.length === 0;
  const selectedType = typeMeta(type);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Header */}
        <header className="space-y-4">
          <button
            type="button"
            onClick={() => router.push("/engagements")}
            className="inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-slate-600 transition hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M12 5l-5 5 5 5" />
            </svg>
            My households
          </button>

          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Work records
            </h1>
            <p className="mt-1.5 text-slate-600">
              Keep track of leave, advances, salary and bonuses.
            </p>
          </div>
        </header>

        {/* This month summary */}
        {!loading && visibleEntries.length > 0 && (
          <section
            aria-label={`Summary for ${thisMonth.label}`}
            className="rounded-2xl bg-slate-900 p-5 text-white shadow-sm"
          >
            <p className="text-sm text-slate-300">{thisMonth.label}</p>
            <dl className="mt-3 grid grid-cols-3 gap-4">
              <div>
                <dt className="text-xs text-slate-400">Leave taken</dt>
                <dd className="mt-1 text-xl font-bold sm:text-2xl">
                  {thisMonth.leave}{" "}
                  <span className="text-sm font-medium text-slate-400">
                    {thisMonth.leave === 1 ? "day" : "days"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Advances</dt>
                <dd className="mt-1 text-xl font-bold sm:text-2xl">
                  {formatMoney(thisMonth.advances)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">Money received</dt>
                <dd className="mt-1 text-xl font-bold text-emerald-300 sm:text-2xl">
                  {formatMoney(thisMonth.received)}
                </dd>
              </div>
            </dl>
          </section>
        )}

        {/* No households */}
        {noHouseholds ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-semibold text-slate-900">
              Add a household to start recording
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Records are kept separately for each home you work in.
            </p>
            <button
              type="button"
              onClick={() => router.push("/engagements")}
              className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
            >
              Add a household
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
          >
            <h2 className="text-xl font-bold text-slate-900">Add a record</h2>

            {/* Type */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">
                What do you want to record?
              </legend>
              <div
                role="radiogroup"
                aria-label="Record type"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {TYPE_OPTIONS.map((option) => {
                  const selected = type === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setType(option.value)}
                      className={`rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 ${
                        selected
                          ? option.chip
                          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span className="block text-sm font-semibold">
                        {option.label}
                      </span>
                      <span
                        className={`mt-0.5 block text-xs ${
                          selected ? "text-white/80" : "text-slate-500"
                        }`}
                      >
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  htmlFor="household"
                  className="block text-sm font-medium text-slate-700"
                >
                  Household
                </label>
                <select
                  id="household"
                  value={householdId}
                  onChange={(e) => setHouseholdId(e.target.value)}
                  required
                  className={inputClass}
                >
                  <option value="">Select a household</option>
                  {households.map((household) => (
                    <option key={household.id} value={household.id}>
                      {household.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="date"
                  className="block text-sm font-medium text-slate-700"
                >
                  Date
                </label>
                <input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {type !== "leave" && (
              <div className="space-y-1.5">
                <label
                  htmlFor="amount"
                  className="block text-sm font-medium text-slate-700"
                >
                  Amount
                </label>
                <div className="flex rounded-xl border border-slate-200 bg-white transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-100">
                  <span className="flex items-center rounded-l-xl border-r border-slate-200 bg-slate-50 px-4 text-slate-500">
                    ₹
                  </span>
                  <input
                    id="amount"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="e.g. 2000"
                    className="w-full rounded-r-xl bg-transparent px-4 py-3 text-lg font-semibold text-slate-900 placeholder:text-base placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="note"
                  className="block text-sm font-medium text-slate-700"
                >
                  Note{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <span className="text-xs text-slate-400">{note.length}/500</span>
              </div>
              <textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="e.g. Fever, went to the doctor"
                className={inputClass}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {success && (
              <p
                role="status"
                className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5 shrink-0"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.58 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={saving || loading || households.length === 0}
              className="w-full rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : `Save ${selectedType.label.toLowerCase()}`}
            </button>
          </form>
        )}

        {/* Load error when the form isn't shown */}
        {error && noHouseholds && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {/* History */}
        <section aria-label="Record history" className="space-y-5">
          <h2 className="text-xl font-bold text-slate-900">History</h2>

          {loading ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4"
                >
                  <div className="h-14 w-14 rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/3 rounded bg-slate-100" />
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
              {noHouseholds
                ? "Records will show up here."
                : "No records yet. Add your first one above."}
            </div>
          ) : (
            grouped.map(([key, monthEntries]) => (
              <div key={key} className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-500">
                  {monthLabel(key)}
                </h3>

                {monthEntries.map((entry) => {
                  const meta = typeMeta(entry.type);
                  const d = parseDate(entry.entry_date);

                  return (
                    <article
                      key={entry.id}
                      className="flex gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div
                        aria-hidden="true"
                        className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${meta.tile}`}
                      >
                        <span className="text-xl font-bold leading-none">
                          {d.getDate()}
                        </span>
                        <span className="mt-1 text-xs font-medium">
                          {d.toLocaleDateString("en-IN", { month: "short" })}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="font-semibold text-slate-900">
                              {entry.type === "payment"
                                ? "Salary / payment"
                                : meta.label}
                            </h4>
                            <p className="truncate text-sm text-slate-500">
                              {householdName(entry.engagement_id)}
                            </p>
                          </div>

                          {entry.amount !== null && (
                            <p className="shrink-0 text-lg font-bold text-slate-900">
                              {formatMoney(Number(entry.amount))}
                            </p>
                          )}
                        </div>

                        {entry.note && (
                          <p className="mt-2 text-sm text-slate-600">
                            {entry.note}
                          </p>
                        )}

                        <span
                          className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                            STATUS_STYLES[entry.status]
                          }`}
                        >
                          {STATUS_LABELS[entry.status]}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}