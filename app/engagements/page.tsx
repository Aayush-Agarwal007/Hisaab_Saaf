"use client";

import { useCallback, useEffect, useState, FormEvent } from "react";

import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

type Engagement = {

  id: string;

  label: string;

  employer_phone: string | null;

  paid_leave_per_month: number;

  weekly_off: string | null;

  start_date: string;

  active: boolean;

};

const WEEK_DAYS = [

  "None",

  "Monday",

  "Tuesday",

  "Wednesday",

  "Thursday",

  "Friday",

  "Saturday",

  "Sunday",

] as const;

function getTodayDateString() {

  const now = new Date();

  const year = now.getFullYear();

  const month = String(now.getMonth() + 1).padStart(2, "0");

  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;

}

// Parse "YYYY-MM-DD" manually so the date never shifts with timezones.

function formatDate(value: string) {

  const [y, m, d] = value.split("-").map(Number);

  if (!y || !m || !d) return value;

  return new Date(y, m - 1, d).toLocaleDateString("en-IN", {

    day: "numeric",

    month: "short",

    year: "numeric",

  });

}

function getInitials(name: string) {

  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[1][0]).toUpperCase();

}

const inputClass =

  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 transition focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100";

export default function EngagementsPage() {

  const router = useRouter();

  const [engagements, setEngagements] = useState<Engagement[]>([]);

  const [label, setLabel] = useState("");

  const [employerPhone, setEmployerPhone] = useState("");

  const [paidLeave, setPaidLeave] = useState(2);

  const [weeklyOff, setWeeklyOff] = useState<string>("Sunday");

  const [startDate, setStartDate] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  useEffect(() => {

    setStartDate(getTodayDateString());

  }, []);

  const loadEngagements = useCallback(async () => {

    const supabase = createClient();

    setLoading(true);

    setError("");

    const {

      data: { user },

      error: authError,

    } = await supabase.auth.getUser();

    if (authError || !user) {

      setLoading(false);

      router.replace("/login");

      return;

    }

    const { data, error: queryError } = await supabase

      .from("engagements")

      .select(

        "id, label, employer_phone, paid_leave_per_month, weekly_off, start_date, active"

      )

      .eq("worker_id", user.id)

      .order("created_at", { ascending: false });

    if (queryError) {

      console.error("Load engagements failed:", {

        code: queryError.code,

        message: queryError.message,

        details: queryError.details,

        hint: queryError.hint,

      });

      setError("Could not load households. Please try again.");

    } else {

      setEngagements((data ?? []) as Engagement[]);

    }

    setLoading(false);

  }, [router]);

  useEffect(() => {

    let cancelled = false;

    async function load() {

      await loadEngagements();

      if (cancelled) {

        return;

      }

    }

    void load();

    return () => {

      cancelled = true;

    };

  }, [loadEngagements]);

  function resetForm() {

    setLabel("");

    setEmployerPhone("");

    setPaidLeave(2);

    setWeeklyOff("Sunday");

    setStartDate(getTodayDateString());

  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    setError("");

    setSuccess("");

    const trimmedLabel = label.trim();

    if (!trimmedLabel) {

      setError("Please enter a household or employer name.");

      return;

    }

    if (!/^[6-9]\d{9}$/.test(employerPhone)) {

      setError("Enter a valid 10-digit employer mobile number.");

      return;

    }

    if (!Number.isInteger(paidLeave) || paidLeave < 0 || paidLeave > 31) {

      setError("Paid leave must be a whole number between 0 and 31 days.");

      return;

    }

    if (!startDate) {

      setError("Please select the work start date.");

      return;

    }

    setSaving(true);

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

      const { error: insertError } = await supabase

        .from("engagements")

        .insert({

          worker_id: user.id,

          label: trimmedLabel,

          employer_phone: employerPhone,

          paid_leave_per_month: paidLeave,

weekly_off:
  weeklyOff === "None"
    ? null
    : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(weeklyOff),
          start_date: startDate,

        });

      if (insertError) {

        console.error("Create engagement failed:", {

          code: insertError.code,

          message: insertError.message,

          details: insertError.details,

          hint: insertError.hint,

        });

        setError(`Save failed: ${insertError.message}`);

        return;

      }

      resetForm();

      setShowForm(false);

      setSuccess("Household added.");

      await loadEngagements();

    } catch (caughtError) {

      console.error("Unexpected error while saving engagement:", caughtError);

      setError("Something went wrong. Please try again.");

    } finally {

      setSaving(false);

    }

  }

  const formVisible = showForm || (!loading && engagements.length === 0);

  return (

    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8 sm:py-10">

      <div className="mx-auto max-w-2xl space-y-8">

        {/* Header */}

        <header className="space-y-4">

          <button

            type="button"

            onClick={() => router.push("/")}

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

            Dashboard

          </button>

          <div className="flex items-end justify-between gap-4">

            <div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900">

                My households

              </h1>

              <p className="mt-1.5 text-slate-600">

                {loading

                  ? "Loading your households…"

                  : engagements.length === 0

                  ? "Add the first home where you work."

                  : `${engagements.length} ${

                      engagements.length === 1 ? "household" : "households"

                    } you work for.`}

              </p>

            </div>

            {!loading && engagements.length > 0 && (

              <button

                type="button"

                onClick={() => {

                  setShowForm((open) => !open);

                  setError("");

                  setSuccess("");

                }}

                aria-expanded={showForm}

                className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"

              >

                {showForm ? "Close" : "Add household"}

              </button>

            )}

          </div>

        </header>

        {/* Success toast (when the form is closed) */}

        {success && !formVisible && (

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

        {/* Load error (when the form is closed) */}

        {error && !formVisible && (

          <p

            role="alert"

            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"

          >

            {error}

          </p>

        )}

        {/* Form */}

        {formVisible && (

          <form

            onSubmit={handleSubmit}

            className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"

          >

            <div>

              <h2 className="text-xl font-bold text-slate-900">

                Add a household

              </h2>

              <p className="mt-1 text-sm text-slate-500">

                We use this to keep attendance and leave for each home separate.

              </p>

            </div>

            <div className="space-y-1.5">

              <label

                htmlFor="label"

                className="block text-sm font-medium text-slate-700"

              >

                Household or employer name

              </label>

              <input

                id="label"

                value={label}

                onChange={(event) => setLabel(event.target.value)}

                maxLength={100}

                required

                placeholder="e.g. Sharma family"

                className={inputClass}

              />

            </div>

            <div className="space-y-1.5">

              <label

                htmlFor="employerPhone"

                className="block text-sm font-medium text-slate-700"

              >

                Employer mobile number

              </label>

              <div className="flex rounded-xl border border-slate-200 bg-white transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-100">

                <span className="flex items-center rounded-l-xl border-r border-slate-200 bg-slate-50 px-4 text-slate-500">

                  +91

                </span>

                <input

                  id="employerPhone"

                  type="tel"

                  inputMode="numeric"

                  autoComplete="tel-national"

                  value={employerPhone}

                  onChange={(event) =>

                    setEmployerPhone(

                      event.target.value.replace(/\D/g, "").slice(0, 10)

                    )

                  }

                  maxLength={10}

                  required

                  placeholder="10-digit number"

                  className="w-full rounded-r-xl bg-transparent px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none"

                />

              </div>

            </div>

            {/* Weekly off */}

            <fieldset className="space-y-2">

              <legend className="text-sm font-medium text-slate-700">

                Weekly day off

              </legend>

              <div

                role="radiogroup"

                aria-label="Weekly day off"

                className="flex flex-wrap gap-2"

              >

                {WEEK_DAYS.map((day) => {

                  const selected = weeklyOff === day;

                  return (

                    <button

                      key={day}

                      type="button"

                      role="radio"

                      aria-checked={selected}

                      onClick={() => setWeeklyOff(day)}

                      className={`rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 ${

                        selected

                          ? "border-emerald-600 bg-emerald-600 text-white"

                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"

                      }`}

                    >

                      {day === "None" ? "No fixed day" : day.slice(0, 3)}

                    </button>

                  );

                })}

              </div>

            </fieldset>

            <div className="grid gap-6 sm:grid-cols-2">

              {/* Paid leave stepper */}

              <div className="space-y-1.5">

                <label

                  htmlFor="paidLeave"

                  className="block text-sm font-medium text-slate-700"

                >

                  Paid leave per month

                </label>

                <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-100">

                  <button

                    type="button"

                    onClick={() => setPaidLeave((v) => Math.max(0, v - 1))}

                    disabled={paidLeave <= 0}

                    aria-label="Decrease paid leave"

                    className="flex h-12 w-12 items-center justify-center text-xl text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"

                  >

                    −

                  </button>

                  <input

                    id="paidLeave"

                    type="number"

                    min={0}

                    max={31}

                    step={1}

                    value={paidLeave}

                    onChange={(event) => {

                      const next = Number(event.target.value);

                      if (Number.isNaN(next)) return;

                      setPaidLeave(Math.min(31, Math.max(0, Math.trunc(next))));

                    }}

                    required

                    className="w-full min-w-0 appearance-none bg-transparent text-center font-semibold text-slate-900 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

                  />

                  <button

                    type="button"

                    onClick={() => setPaidLeave((v) => Math.min(31, v + 1))}

                    disabled={paidLeave >= 31}

                    aria-label="Increase paid leave"

                    className="flex h-12 w-12 items-center justify-center text-xl text-slate-600 transition hover:bg-slate-50 disabled:opacity-30"

                  >

                    +

                  </button>

                </div>

                <p className="text-xs text-slate-500">days each month</p>

              </div>

              <div className="space-y-1.5">

                <label

                  htmlFor="startDate"

                  className="block text-sm font-medium text-slate-700"

                >

                  Work start date

                </label>

                <input

                  id="startDate"

                  type="date"

                  value={startDate}

                  onChange={(event) => setStartDate(event.target.value)}

                  required

                  className={inputClass}

                />

              </div>

            </div>

            {error && (

              <p

                role="alert"

                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"

              >

                {error}

              </p>

            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

              {engagements.length > 0 && (

                <button

                  type="button"

                  onClick={() => {

                    setShowForm(false);

                    setError("");

                  }}

                  className="rounded-xl border border-slate-200 px-5 py-3 font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-100"

                >

                  Cancel

                </button>

              )}

              <button

                type="submit"

                disabled={saving}

                className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"

              >

                {saving ? "Saving…" : "Save household"}

              </button>

            </div>

          </form>

        )}

        {/* List */}

        <section aria-label="Saved households" className="space-y-3">

          {loading ? (

            <div className="space-y-3" aria-busy="true">

              {[0, 1].map((i) => (

                <div

                  key={i}

                  className="animate-pulse rounded-2xl border border-slate-100 bg-white p-5"

                >

                  <div className="flex items-center gap-4">

                    <div className="h-12 w-12 rounded-full bg-slate-100" />

                    <div className="flex-1 space-y-2">

                      <div className="h-4 w-1/3 rounded bg-slate-100" />

                      <div className="h-3 w-1/2 rounded bg-slate-100" />

                    </div>

                  </div>

                  <div className="mt-5 h-10 rounded bg-slate-50" />

                </div>

              ))}

            </div>

          ) : engagements.length === 0 ? null : (

            engagements.map((item) => (

              <article

                key={item.id}

                className={`rounded-2xl border bg-white p-5 shadow-sm ${

                  item.active ? "border-slate-200" : "border-slate-200 opacity-75"

                }`}

              >

                <div className="flex items-start gap-4">

                  <div

                    aria-hidden="true"

                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-base font-bold text-emerald-800"

                  >

                    {getInitials(item.label)}

                  </div>

                  <div className="min-w-0 flex-1">

                    <div className="flex items-start justify-between gap-3">

                      <h3 className="truncate text-lg font-bold text-slate-900">

                        {item.label}

                      </h3>

                      <span

                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${

                          item.active

                            ? "bg-emerald-50 text-emerald-700"

                            : "bg-slate-100 text-slate-500"

                        }`}

                      >

                        {item.active ? "Active" : "Inactive"}

                      </span>

                    </div>

                    {item.employer_phone ? (

                      <a

                        href={`tel:+91${item.employer_phone}`}

                        className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-700"

                      >

                        <svg

                          viewBox="0 0 20 20"

                          fill="currentColor"

                          className="h-4 w-4"

                          aria-hidden="true"

                        >

                          <path d="M2 3.5A1.5 1.5 0 013.5 2h1.15a1.5 1.5 0 011.45 1.13l.53 2.1a1.5 1.5 0 01-.4 1.45l-.9.9a11 11 0 004.1 4.1l.9-.9a1.5 1.5 0 011.45-.4l2.1.53A1.5 1.5 0 0118 14.35v1.15A1.5 1.5 0 0116.5 17C8.49 17 2 10.51 2 2.5v1z" />

                        </svg>

                        +91 {item.employer_phone}

                      </a>

                    ) : (

                      <p className="mt-0.5 text-sm text-slate-400">

                        No phone number added

                      </p>

                    )}

                  </div>

                </div>

                <dl className="mt-5 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50 py-3 text-center">

                  <div className="px-2">

                    <dt className="text-xs text-slate-500">Paid leave</dt>

                    <dd className="mt-0.5 text-sm font-semibold text-slate-900">

                      {item.paid_leave_per_month}{" "}

                      {item.paid_leave_per_month === 1 ? "day" : "days"}/mo

                    </dd>

                  </div>

                  <div className="px-2">

                    <dt className="text-xs text-slate-500">Weekly off</dt>

                    <dd className="mt-0.5 text-sm font-semibold text-slate-900">

                      {item.weekly_off && item.weekly_off !== "None"

                        ? item.weekly_off

                        : "Not set"}

                    </dd>

                  </div>

                  <div className="px-2">

                    <dt className="text-xs text-slate-500">Started</dt>

                    <dd className="mt-0.5 text-sm font-semibold text-slate-900">

                      {formatDate(item.start_date)}

                    </dd>

                  </div>

                </dl>

              </article>

            ))

          )}

        </section>

      </div>

    </main>

  );

}
