"use client";
import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import type { BillingPolicy } from "@/lib/types";
import type { FormState } from "../../actions";
import { Label, btnPrimary, input } from "../ui";
import { SubmitButton } from "../submit";

const dollars = (c: number) => (c % 100 ? (c / 100).toFixed(2) : String(c / 100));
const toggle = "flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ring-line transition-colors has-[:checked]:bg-ink/[.03] has-[:checked]:ring-line-strong";
const box = "mt-0.5 h-[18px] w-[18px] shrink-0 accent-ink";

/** Late fees and part payments: the rules the house bills by. Staff can see them; owners change them. */
export function BillingRules({ policy, canEdit, save }: { policy: BillingPolicy; canEdit: boolean; save: (s: FormState, f: FormData) => Promise<FormState> }) {
  const [state, run] = useActionState(save, null);
  const [fee, setFee] = useState(policy.lateFeeCents > 0);
  const [part, setPart] = useState(policy.partialPayments);

  return (
    <form action={run} className="grid gap-3 p-5 pt-4 sm:p-6 sm:pt-4">
      <fieldset disabled={!canEdit} className="grid gap-3 disabled:opacity-80">
        <label className={toggle}>
          <input type="checkbox" name="lateFeeOn" checked={fee} onChange={(e) => setFee(e.target.checked)} className={box} />
          <span className="min-w-0">
            <span className="block text-[0.93rem] font-medium">Add a late fee</span>
            <span className="block text-[0.82rem] leading-snug text-moss">Once per month&apos;s rent, never more than 10% of it (Virginia&apos;s limit). Not while a bank payment is clearing.</span>
          </span>
        </label>
        {fee && (
          <div className="grid grid-cols-2 gap-3">
            <label>
              <Label>Fee</Label>
              <div className="relative">
                <span className="mono pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-moss">$</span>
                <input name="lateFee" inputMode="decimal" required defaultValue={policy.lateFeeCents ? dollars(policy.lateFeeCents) : "25"} className={`${input} mono pl-7`} />
              </div>
            </label>
            <label>
              <Label>Days late</Label>
              <input name="lateFeeAfterDays" type="number" min={1} max={30} required defaultValue={policy.lateFeeAfterDays} className={`${input} mono`} />
            </label>
          </div>
        )}

        <label className={toggle}>
          <input type="checkbox" name="partialPayments" checked={part} onChange={(e) => setPart(e.target.checked)} className={box} />
          <span className="min-w-0">
            <span className="block text-[0.93rem] font-medium">Let residents pay part</span>
            <span className="block text-[0.82rem] leading-snug text-moss">They choose how much on their pay page. The rest stays owed, oldest charge first.</span>
          </span>
        </label>
        {part && (
          <label>
            <Label>Smallest payment</Label>
            <div className="relative">
              <span className="mono pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-moss">$</span>
              <input name="minPart" inputMode="decimal" required defaultValue={dollars(policy.minPartCents)} className={`${input} mono pl-7`} />
            </div>
          </label>
        )}
        {!fee && <input type="hidden" name="lateFeeAfterDays" value={policy.lateFeeAfterDays} />}
        {!part && <input type="hidden" name="minPart" value={dollars(policy.minPartCents)} />}
      </fieldset>

      {canEdit ? (
        <SubmitButton className={`${btnPrimary} w-full disabled:opacity-60`}>Save rules</SubmitButton>
      ) : (
        <p className="text-[0.82rem] text-moss">Only an owner can change these.</p>
      )}
      {state && (
        <p role="status" className={`flex items-center gap-1.5 text-[0.86rem] ${state.error ? "text-ember" : "text-moss"}`}>
          {state.ok && <Check size={14} strokeWidth={3} />} {state.error ?? state.ok}
        </p>
      )}
    </form>
  );
}
