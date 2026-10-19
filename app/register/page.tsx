"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (displayName.trim().length < 2) {
      setError("Please enter your name.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    if (!/^\d{6}$/.test(pin)) {
      setError("Your PIN must contain exactly 6 digits.");
      return;
    }

    if (pin !== confirmPin) {
      setError("The two PINs do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName: displayName.trim(),
          phone,
          pin,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Registration failed. Please try again.");
        return;
      }

      router.replace("/login?registered=1");
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4 sm:p-6">
      <div className="w-full max-w-md">
        <form
          onSubmit={handleRegister}
          className="space-y-5 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl"
        >
          <header className="space-y-2 text-center">
            <h1 className="text-3xl font-extrabold text-slate-900">
              Create your account
            </h1>
            <p className="text-sm text-slate-600">
              Start keeping your work records with Hisaab Saaf.
            </p>
          </header>

          <div className="space-y-1.5">
            <label
              htmlFor="displayName"
              className="block text-sm font-semibold text-slate-700"
            >
              Full name
            </label>
            <input
              id="displayName"
              type="text"
              autoComplete="name"
              maxLength={80}
              required
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Enter your name"
            />
          </div>

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
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="10-digit mobile number"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="pin"
              className="block text-sm font-semibold text-slate-700"
            >
              Create a six-digit PIN
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              required
              value={pin}
              onChange={(event) =>
                setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="6 digits"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="confirmPin"
              className="block text-sm font-semibold text-slate-700"
            >
              Confirm PIN
            </label>
            <input
              id="confirmPin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={6}
              required
              value={confirmPin}
              onChange={(event) =>
                setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="Enter PIN again"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-slate-900 px-4 py-3.5 font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p className="text-center text-sm text-slate-600">
            Already registered?{" "}
            <Link
              href="/login"
              className="font-semibold text-emerald-700 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
