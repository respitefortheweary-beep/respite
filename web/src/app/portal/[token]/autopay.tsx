"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { CalendarCheck, Loader2 } from "lucide-react";

function Submit({ children, quiet }: { children: React.ReactNode; quiet?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className={`press inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[0.92rem] font-medium disabled:opacity-70 ${quiet ? "text-moss ring-1 ring-line hover:bg-ink/[.04] hover:text-ink" : "bg-ink text-white hover:bg-[#2a2d2b]"}`}
    >
      {pending && <Loader2 size={15} className="animate-spin" />}
      {pending ? "One moment" : children}
    </button>
  );
}

/** Rent paid on its due date from a saved card or bank account. */
export function Autopay({
  on, label, stripe, failed, clearing, start, stop,
}: {
  on: boolean; label: string | null; stripe: boolean; failed: boolean; clearing: boolean;
  start: () => Promise<void>; stop: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="mt-10">
      <h2 className="eyebrow">Autopay</h2>
      <div className="mt-3 rounded-2xl bg-paper p-5 ring-1 ring-line">
        <div className="flex items-start gap-3">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${on ? "bg-porch text-ink" : "bg-ink/[.06] text-moss"}`}>
            <CalendarCheck size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.98rem] font-medium">{on ? "On" : "Off"}{on && label ? ` · ${label}` : ""}</p>
            <p className="mt-1 text-[0.88rem] leading-snug text-moss">
              {on
                ? "Rent is paid on the day it's due. You'll still get an email each month before it goes out."
                : `Save a card or bank account once and rent pays itself on the day it's due.${stripe ? " Saved securely by Stripe." : ""}`}
            </p>
            {failed && <p className="mt-2 text-[0.88rem] leading-snug text-ember">The last try didn&apos;t go through. Pay above, or save a different card and we&apos;ll try again.</p>}
            {clearing && <p className="mt-2 text-[0.88rem] leading-snug text-moss">A bank payment is on its way. Bank payments take a few days to clear.</p>}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {!on && (
            <form action={start}><Submit>Turn on autopay</Submit></form>
          )}
          {on && !confirming && (
            <>
              {(failed || stripe) && <form action={start}><Submit quiet>Use a different card</Submit></form>}
              <button type="button" onClick={() => setConfirming(true)} className="press inline-flex h-11 items-center rounded-full px-4 text-[0.92rem] text-moss hover:text-ink">
                Turn off
              </button>
            </>
          )}
          {on && confirming && (
            <>
              <form action={stop}><Submit>Yes, turn it off</Submit></form>
              <button type="button" onClick={() => setConfirming(false)} className="press inline-flex h-11 items-center rounded-full px-4 text-[0.92rem] text-moss hover:text-ink">
                Keep it on
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
