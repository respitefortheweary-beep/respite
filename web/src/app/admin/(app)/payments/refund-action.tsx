"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, MoreHorizontal, Undo2 } from "lucide-react";
import type { FormState } from "../../actions";

/**
 * Menu on a paid charge: give the money back in full.
 * Online payments go back through Stripe; anything paid by hand is recorded as handed back.
 */
export function RefundAction({ amount, online, refund }: { amount: string; online: boolean; refund: (note: string) => Promise<FormState> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => setResult(null), result.error ? 6000 : 3200);
    return () => clearTimeout(t);
  }, [result]);

  const go = () =>
    start(async () => {
      const r = await refund(note);
      setOpen(false);
      setNote("");
      setResult(r);
    });

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={pending}
        aria-label="Payment options"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="press grid h-10 w-10 place-items-center rounded-full text-moss transition-colors hover:bg-ink/[.06] hover:text-ink"
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : <MoreHorizontal size={18} />}
      </button>

      {result && (
        <p
          role="status"
          className={`absolute right-0 top-full z-20 mt-1 flex w-max max-w-[17rem] items-start gap-1.5 rounded-lg px-3 py-2 text-[0.82rem] leading-snug shadow-[0_12px_32px_-12px_rgb(15_17_16/.45)] ${result.error ? "bg-ember text-white" : "bg-ink text-white"}`}
        >
          {result.ok && <Check size={13} strokeWidth={3} className="mt-0.5 shrink-0 text-porch" />}
          {result.error ?? result.ok}
        </p>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={`Refund ${amount}`}
          className="absolute right-0 top-full z-30 mt-1 w-72 origin-top-right rounded-2xl bg-paper p-4 text-left shadow-[0_18px_44px_-14px_rgb(15_17_16/.45)] ring-1 ring-line-strong [animation:menu-pop_150ms_var(--ease-out)]"
        >
          <p className="flex items-center gap-2 font-semibold tracking-[-0.01em]">
            <Undo2 size={15} className="text-moss" /> Refund {amount}
          </p>
          <p className="mt-1.5 text-[0.85rem] leading-snug text-moss">
            {online
              ? "Sends the full amount back to the card or bank account they paid with, through Stripe. This can't be undone."
              : "Records that you gave the money back by hand. Nothing is sent through Stripe."}
          </p>
          <label className="mt-3 block">
            <span className="mb-1 block text-[0.8rem] font-medium">Note for the resident (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="Overpaid by mistake"
              className="h-10 w-full rounded-xl bg-paper px-3 text-[0.92rem] ring-1 ring-line-strong outline-none placeholder:text-ink/35 focus:ring-2 focus:ring-ink"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="press h-10 flex-1 rounded-full text-[0.88rem] text-moss ring-1 ring-line-strong hover:text-ink">
              Cancel
            </button>
            <button type="button" onClick={go} disabled={pending} className="press h-10 flex-1 rounded-full bg-ember text-[0.88rem] font-medium text-white hover:bg-[#a83e23] disabled:opacity-60">
              {online ? "Refund" : "Mark refunded"}
            </button>
          </div>
          <p className="mt-2.5 text-[0.76rem] text-moss">If they have an email on file, they get one about it.</p>
        </div>
      )}
      <style>{`@keyframes menu-pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}
