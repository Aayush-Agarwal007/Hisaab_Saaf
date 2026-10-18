
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import ConfirmationActions from "./ConfirmationActions";

export const instant = false;

type Props = {
  params: Promise<{ token: string }>;
};

function MessagePage({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
      </section>
    </main>
  );
}

function isExpired(expiresAt: string) {
  return new Date(expiresAt).getTime() <= Date.now();
}

export default async function ConfirmationPage({ params }: Props) {
  const { token } = await params;

  if (!/^[a-f0-9]{64}$/.test(token)) {
    return (
      <MessagePage
        title="Invalid confirmation link"
        message="This link is not valid. Please ask the worker to generate a new confirmation link."
      />
    );
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const admin = createAdminClient();

  const { data: tokenRecord, error: tokenError } = await admin
    .from("tokens")
    .select("id, entry_id, engagement_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .eq("purpose", "entry")
    .maybeSingle();

  if (tokenError) {
    console.error("Confirmation token lookup failed:", tokenError.message);

    return (
      <MessagePage
        title="Unable to load confirmation"
        message="Something went wrong while checking this link. Please try again later."
      />
    );
  }

  if (!tokenRecord || tokenRecord.used_at) {
    return (
      <MessagePage
        title="Link unavailable"
        message="This confirmation link is invalid or has already been used. Please ask the worker for a new link if needed."
      />
    );
  }

  if (isExpired(tokenRecord.expires_at)) {
    return (
      <MessagePage
        title="Link expired"
        message="This confirmation link has expired. Please ask the worker to generate a new one."
      />
    );
  }

  const { data: entry, error: entryError } = await admin
    .from("entries")
    .select("id, type, entry_date, amount, note, status")
    .eq("id", tokenRecord.entry_id)
    .eq("engagement_id", tokenRecord.engagement_id)
    .maybeSingle();

  const { data: household, error: householdError } = await admin
    .from("engagements")
    .select("label")
    .eq("id", tokenRecord.engagement_id)
    .maybeSingle();

  if (entryError || householdError) {
    console.error("Confirmation record lookup failed:", {
      entryError: entryError?.message,
      householdError: householdError?.message,
    });

    return (
      <MessagePage
        title="Unable to load record"
        message="We couldn't load the record details. Please try again later."
      />
    );
  }

  if (!entry || !household) {
    return (
      <MessagePage
        title="Record unavailable"
        message="The record associated with this link could not be found."
      />
    );
  }

  if (entry.status !== "pending") {
    return (
      <MessagePage
        title="Record already reviewed"
        message={`This record's current status is "${entry.status}". No further action is available through this link.`}
      />
    );
  }

  const recordTypes: Record<string, string> = {
    leave: "Leave",
    advance: "Salary advance",
    payment: "Salary / payment",
    bonus: "Bonus",
  };

  const date = new Date(`${entry.entry_date}T00:00:00`).toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
          Hisaab Saaf
        </p>

        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          Review work record
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Please check the details below. Confirm the record if they are
          correct, or dispute it if something needs to be corrected.
        </p>

        <div className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Household
            </p>
            <p className="mt-1 font-semibold text-slate-900">
              {household.label}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Record type
              </p>
              <p className="mt-1 font-medium text-slate-900">
                {recordTypes[entry.type] ?? entry.type}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Date
              </p>
              <p className="mt-1 font-medium text-slate-900">{date}</p>
            </div>
          </div>

          {entry.amount !== null && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Amount
              </p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                ₹{Number(entry.amount).toLocaleString("en-IN")}
              </p>
            </div>
          )}

          {entry.note && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Note
              </p>
              <p className="mt-1 whitespace-pre-wrap text-slate-800">
                {entry.note}
              </p>
            </div>
          )}
        </div>

        <p className="mt-5 text-sm text-slate-600">
          This record is awaiting review.
        </p>

        <ConfirmationActions token={token} />
      </section>
    </main>
  );
}
