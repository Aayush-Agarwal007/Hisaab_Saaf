
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function ForgotPinPage() {
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Please enter a valid 10-digit Indian mobile number.");
      return;
    }

    setMessage(
      "Your number format is valid, but SMS verification is not configured yet. Your PIN has not been changed. Please try again after OTP recovery is enabled."
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl">
          🔐
        </div>

        <p className="mt-5 text-sm font-semibold text-emerald-700">
          Hisaab Saaf
        </p>

        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Reset your PIN
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Enter your registered mobile number to check recovery
          availability. We will never change your PIN without
          verifying your identity.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="phone"
              className="block text-sm font-semibold text-slate-700"
            >
              Registered mobile number
            </label>

            <input
              id="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={10}
              required
              value={phone}
              onChange={(event) => {
                setPhone(
                  event.target.value.replace(/\D/g, "").slice(0, 10)
                );
                setError("");
                setMessage("");
              }}
              placeholder="10-digit mobile number"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
              aria-describedby={error ? "phone-error" : undefined}
            />
          </div>

          {error && (
            <p
              id="phone-error"
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {message && (
            <p
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          >
            Check recovery availability
          </button>
        </form>

        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-800">
            SMS verification is not active yet
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This development version does not send OTPs or reset
            account passwords. Your existing login remains unchanged.
          </p>
        </div>

        <Link
          href="/login"
          className="mt-6 flex w-full justify-center rounded-xl border border-slate-200 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Back to login
        </Link>
      </section>
    </main>
  );
}
