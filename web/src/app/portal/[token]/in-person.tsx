"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Banknote, Check, Loader2 } from "lucide-react";

const WAYS = [
  ["CASH", "Cash"],
  ["CHECK", "Check"],
  ["MONEY_ORDER", "Money order"],
  ["VOUCHER", "Program voucher"],
] as const;
const BRINGING: Record<string, string> = { CASH: "cash", CHECK: "a check", MONEY_ORDER: "a money order", VOUCHER: "a program voucher" };

function Send() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="press inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white/10 text-[0.98rem] font-medium text-white ring-1 ring-white/20 hover:bg-white/15 disabled:opacity-70">
      {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
      {pending ? "One moment" : "Tell the house"}
    </button>
  );
}

/** "I'll pay at the house": the resident picks how, and the owners know to expect it. */
export function InPerson({ action, chargeIds, planned, address }: { action: (f: FormData) => Promise<void>; chargeIds: string[]; planned: string | null; address: string }) {
  const [open, setOpen] = useState(false);

  if (planned && !open)
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-white/[.06] p-4 text-[0.9rem] leading-snug ring-1 ring-white/10">
        <Banknote size={18} className="mt-0.5 shrink-0 text-porch" />
        <div className="min-w-0">
          <p>
            You said you&apos;ll pay with {BRINGING[planned] ?? "cash"}. Hand it to the house manager{address ? ` at ${address}` : ""} and it&apos;ll show as paid here, with a receipt by email.
          </p>
          <button type="button" onClick={() => setOpen(true)} className="mt-2 text-[0.84rem] text-white/60 underline underline-offset-4 hover:text-white">
            Change how you&apos;ll pay
          </button>
        </div>
      </div>
    );

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="press flex h-12 w-full items-center justify-center gap-2 rounded-full text-[0.95rem] text-white/80 ring-1 ring-white/15 hover:bg-white/[.06] hover:text-white">
        <Banknote size={16} /> Pay in person instead
      </button>
    );

  return (
    <form action={action} className="rounded-2xl bg-white/[.06] p-4 ring-1 ring-white/10 [animation:portal-in_300ms_var(--ease-out)]">
      <input type="hidden" name="charges" value={chargeIds.join(",")} />
      <fieldset>
        <legend className="text-[0.95rem] font-medium">How will you pay?</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {WAYS.map(([v, label]) => (
            <label key={v} className="flex h-12 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-[0.92rem] ring-1 ring-white/15 transition-colors has-[:checked]:bg-porch has-[:checked]:text-white has-[:checked]:ring-porch">
              <input type="radio" name="method" value={v} required defaultChecked={v === (planned ?? "CASH")} className="sr-only" />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-[0.82rem] leading-snug text-white/55">We&apos;ll let the house know to expect it. Bring it to the house manager. It shows as paid here once they have it.</p>
      <div className="mt-4">
        <Send />
      </div>
      <button type="button" onClick={() => setOpen(false)} className="mt-1 grid h-10 w-full place-items-center text-[0.86rem] text-white/55 hover:text-white">
        Never mind
      </button>
    </form>
  );
}
