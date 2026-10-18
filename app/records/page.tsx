
"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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

type ShareLink = {
  confirmationUrl: string;
  whatsappUrl: string;
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
  return TYPE_OPTIONS.find((option) => option.value === type) ?? TYPE_OPTIONS[0];
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function formatMoney(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function monthKey(value: string) {
  return value.slice(0, 7);
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);

  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function getLocalDateValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function RecordsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [households, setHouseholds] = useState<Household[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [householdId, setHouseholdId] = useState("");
  const [type, setType] = useState<Entry["type"]>("leave");
  const [date, setDate] = useState("");
  const [currentMonthKey, setCurrentMonthKey] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [sharingEntryId, setSharingEntryId] = useState<string | null>(null);
  const [shareLinks, setShareLinks] = useState<Record<string, ShareLink>>({});
  const [shareError, setShareError] = useState("");

  const fetchEntries = useCallback(async () => {
    const { data, error: entryError } = await supabase
      .from("entries")
      .select("id, engagement_id, type, entry_date, amount, note, status")
      .order("entry_date", { ascending: false });

    return {
      data: (data ?? []) as Entry[],
      error: entryError,
    };
  }, [supabase]);

  useEffect(() => {
    setDate(getLocalDateValue());
    setCurrentMonthKey(getLocalDateValue().slice(0, 7));
  }, []);

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
        setHouseholdId((previous) => previous || householdData[0].id);
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
    setShareError("");

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
        console.error("Save record failed:", insertError);
        setError(`Save failed: ${insertError.message}`);
        return;
      }

      setAmount("");
      setNote("");
      setSuccess("Record saved. You can now request employer confirmation.");

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

  async function handleRequestConfirmation(entry: Entry) {
    setSharingEntryId(entry.id);
    setShareError("");

    try {
      const response = await fetch(
        `/api/entries/${entry.id}/confirmation`,
        { method: "POST" }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not generate a confirmation link."
        );
      }

      if (!result.confirmationUrl || !result.whatsappUrl) {
        throw new Error("The server did not return the confirmation links.");
      }

      setShareLinks((previous) => ({
        ...previous,
        [entry.id]: {
          confirmationUrl: result.confirmationUrl,
          whatsappUrl: result.whatsappUrl,
        },
      }));
    } catch (caughtError) {
      setShareError(
        caughtError instanceof Error
          ? caughtError.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSharingEntryId(null);
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
    const monthEntries = currentMonthKey
      ? visibleEntries.filter(
          (entry) => monthKey(entry.entry_date) === currentMonthKey
        )
      : [];

    const sum = (types: Entry["type"][]) =>
      monthEntries
        .filter((entry) => types.includes(entry.type))
        .reduce((total, entry) => total + Number(entry.amount ?? 0), 0);

    return {
      label: currentMonthKey ? monthLabel(currentMonthKey) : "",
      leave: monthEntries.filter((entry) => entry.type === "leave").length,
      advances: sum(["advance"]),
      received: sum(["payment", "bonus"]),
    };
  }, [visibleEntries, currentMonthKey]);

  function householdName(id: string) {
    return households.find((household) => household.id === id)?.label ?? "Household";
  }

  const noHouseholds = !loading && households.length === 0;
  const selectedType = typeMeta(type);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-8">
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

        {!loading && visibleEntries.length > 0 && currentMonthKey && (
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
              className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
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
                  onChange={(event) => setHouseholdId(event.target.value)}
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
                  onChange={(event) => setDate(event.target.value)}
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
                    onChange={(event) => setAmount(event.target.value)}
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
                  Note <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <span className="text-xs text-slate-400">{note.length}/500</span>
              </div>
              <textarea
                id="note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
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
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
              >
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

        {error && noHouseholds && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <section aria-label="Record history" className="space-y-5">
          <h2 className="text-xl font-bold text-slate-900">History</h2>

          {shareError && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {shareError}
            </p>
          )}

          {loading ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
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
                  const day = parseDate(entry.entry_date);
                  const shareLink = shareLinks[entry.id];

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
                          {day.getDate()}
                        </span>
                        <span className="mt-1 text-xs font-medium">
                          {day.toLocaleDateString("en-IN", { month: "short" })}
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
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                            {entry.note}
                          </p>
                        )}

                        <span
                          className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[entry.status]}`}
                        >
                          {STATUS_LABELS[entry.status]}
                        </span>

                        {entry.status === "pending" && (
                          <div className="mt-3 space-y-3">
                            <button
                              type="button"
                              onClick={() => handleRequestConfirmation(entry)}
                              disabled={sharingEntryId !== null}
                              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {sharingEntryId === entry.id
                                ? "Generating link…"
                                : "Request confirmation"}
                            </button>

                            {shareLink && (
                              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-sm text-slate-600">
                                  Confirmation link generated. Send it to your
                                  employer.
                                </p>

                                <a
                                  href={shareLink.whatsappUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-block rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                                >
                                  Open WhatsApp
                                </a>

                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(
                                        shareLink.confirmationUrl
                                      );
                                      setSuccess("Confirmation link copied.");
                                    } catch {
                                      setShareError(
                                        "Could not copy the link. Open WhatsApp or copy the URL manually."
                                      );
                                    }
                                  }}
                                  className="ml-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                                >
                                  Copy link
                                </button>

                                <p className="break-all text-xs text-slate-500">
                                  {shareLink.confirmationUrl}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
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
