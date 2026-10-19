
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      setError("PIN must contain exactly 6 digits.");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const email = `91${phone}@u.hisaabsaaf.app`;

      const { error: authError } =
        await supabase.auth.signInWithPassword({
          email,
          password: pin,
        });

      if (authError) {
        console.error("Login failed:", {
          code: authError.code,
          status: authError.status,
          message: authError.message,
        });

        if (authError.code === "email_not_confirmed") {
          setError(
            "Your account is not confirmed. Please contact support."
          );
        } else if (
          authError.code === "invalid_credentials" ||
          authError.status === 400
        ) {
          setError(
            "Number or PIN is incorrect. Check your details or use Forgot PIN."
          );
        } else {
          setError("Login failed. Check your connection and try again.");
        }

        return;
      }

      router.replace("/");
      router.refresh();
    } catch (caughtError) {
      console.error("Unexpected login error:", caughtError);
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 p-4 sm:p-6">
      <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-blue-100 opacity-60 blur-3xl" />
      <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-emerald-100 opacity-60 blur-3xl" />

      <div className="relative w-full max-w-md">
        <form
          onSubmit={handleLogin}
          className="space-y-6 rounded-3xl border border-white/50 bg-white/80 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl"
        >
          <header className="space-y-2 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
              Hisaab <span className="text-emerald-600">Saaf</span>
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Aapka kaam, aapka hisaab.
            </p>
            <p className="pt-2 text-sm text-slate-600">
              Sign in to manage your work records.
            </p>
          </header>

          <div className="space-y-5 pt-2">
            <div className="space-y-1.5">
              <label
                htmlFor="phone"
                className="block text-sm font-semibold text-slate-700"
              >
                Mobile number
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                required
                value={phone}
                onChange={(event) =>
                  setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="10-digit mobile number"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="pin"
                className="block text-sm font-semibold text-slate-700"
              >
                Six-digit PIN
              </label>
              <input
                id="pin"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                maxLength={6}
                required
                value={pin}
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-lg tracking-[0.5em] text-slate-900 placeholder:tracking-normal placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="••••••"
              />

              <div className="flex justify-end pt-1">
                <Link
                  href="/forgot-pin"
                  className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                >
                  Forgot PIN?
                </Link>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <p role="alert">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3.5 text-base font-semibold text-white transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Please wait..." : "Andar jaayein"}
          </button>

          <div className="border-t border-slate-200 pt-5 text-center">
            <p className="text-sm font-semibold text-slate-800">
              First time using Hisaab Saaf?
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Worker accounts are currently created by the administrator.
              Contact support to get your account and initial PIN.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
