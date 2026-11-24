"use client";
import { useActionState, useState } from "react";
import { money } from "@/lib/format";
import type { PayState } from "./actions";
import { PayButton } from "./pay-button";

/** Pay everything, or (when the house allows it) just part of it now. */
export function PayForm({
  action, chargeIds, total, minPart, allowPart, note,
}: {
  action: (s: PayState, f: FormData) => Promise<PayState>;
  chargeIds: string[]; total: number; minPart: number; allowPart: boolean; note: string;
}) {
  const [state, run] = useActionState(action, null);
  const [part, setPart] = useState(false);
  const [amount, setAmount] = useState("");
  const typed = Math.round(Number(amount.replace(/[$,\s]/g, "")) * 100);
  const valid = Number.isFinite(typed) && typed >= Math.min(minPart, total) && typed <= total;
  const canPart = allowPart && total > minPart;

  return (
    <form action={run} className="p-6 sm:p-8">
      <input type="hidden" name="charges" value={chargeIds.join(",")} />
      {part && (
        <div className="mb-4 [animation:portal-in_300ms_var(--ease-out)]">
          <label htmlFor="amount" className="text-[0.92rem] font-medium">How much today?</label>
          <div className="mt-2 flex h-14 items-center rounded-2xl bg-white/[.06] px-4 ring-1 ring-white/15 focus-within:ring-porch">
            <span className="mono text-[1.3rem] text-white/50">$</span>
            <input
              id="amount" name="amount" inputMode="decimal" autoComplete="off" autoFocus required
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder={String(Math.round(total / 200))}
              className="mono tabular ml-1 min-w-0 flex-1 bg-transparent text-[1.3rem] outline-none placeholder:text-white/50"
            />
          </div>
          <p className="mt-2 text-[0.8rem] leading-snug text-white/55">
            Anything from {money(minPart)} up to {money(total)}. The rest stays on your balance, oldest charge first.
          </p>
        </div>
      )}
      <PayButton>{part ? (valid ? `Pay ${money(typed)}` : "Pay part") : `Pay ${money(total)}`}</PayButton>
      {state?.error && <p role="alert" className="mt-3 text-center text-[0.86rem] text-[#8fd8cf]">{state.error}</p>}
      <p className="mt-3 text-center text-[0.8rem] text-white/50">{note}</p>
      {canPart && (
        <button
          type="button"
          onClick={() => { setPart(!part); setAmount(""); }}
          className="mx-auto mt-1 grid h-10 place-items-center px-3 text-[0.86rem] text-white/60 underline underline-offset-4 hover:text-white"
        >
          {part ? `Pay all ${money(total)} instead` : "Pay part of it now"}
        </button>
      )}
    </form>
  );
}
