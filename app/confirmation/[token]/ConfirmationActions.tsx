
"use client";

import { useState } from "react";

type Decision = "confirmed" | "contested";

export default function ConfirmationActions({
  token,
}: {
  token: string;
}) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [resolved, setResolved] = useState(false);
  const [messageType, setMessageType] = useState<"success" | "error" | "">(
    ""
  );

  async function submit(decision: Decision) {
    if (loading || resolved) return;

    setLoading(true);
    setMessage("");
    setMessageType("");

    try {
      const response = await fetch("/api/confirm-entry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, decision }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Could not update the record.");
        setMessageType("error");
        return;
      }

      setResolved(true);
      setMessage(
        decision === "confirmed"
          ? "Record confirmed successfully."
          : "Record marked as disputed."
      );
      setMessageType("success");
    } catch {
      setMessage("Connection failed. Please try again.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {!resolved && (
        <>
          <button
            type="button"
            disabled={loading}
            onClick={() => submit("confirmed")}
            className="w-full rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Processing..." : "Confirm record"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => submit("contested")}
            className="w-full rounded-xl border border-red-200 bg-white px-5 py-3 font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Processing..." : "Dispute record"}
          </button>
        </>
      )}

      {message && (
        <p
          role="status"
          aria-live="polite"
          className={`rounded-xl border p-4 text-sm font-medium ${
            messageType === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
