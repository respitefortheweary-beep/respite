"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { X, Loader2, BellRing } from "lucide-react";
import { Q, Field, tile } from "../apply/flow";
import { joinWaitlist, type Program } from "../tour/actions";

type RoomOpt = { slug: string; name: string; full: boolean };

const PROGRAMS: [Program, string][] = [
  ["VETERAN", "Veteran"],
  ["RECOVERY", "In recovery"],
  ["SENIOR", "Independent senior"],
];

export function WaitlistForm({ rooms, initialRoom, initialEmail, openBeds, phone }: { rooms: RoomOpt[]; initialRoom?: string; initialEmail?: string; openBeds: number; phone: { label: string; href: string } }) {
  const [room, setRoom] = useState(rooms.some((r) => r.slug === initialRoom) ? initialRoom! : "");
  const [form, setForm] = useState({ name: "", email: (initialEmail ?? "").slice(0, 200), phone: "" });
  const [program, setProgram] = useState<Program | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ firstName: string; again: boolean } | null>(null);
  const [pending, start] = useTransition();
  const canSend = form.name.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const picked = rooms.find((r) => r.slug === room);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await joinWaitlist({ ...form, phone: form.phone.trim() || undefined, program, room: room || undefined });
      if (res.ok) setDone({ firstName: res.firstName, again: res.again });
      else setError(res.error);
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 pt-5 sm:px-6">
        <Link href="/" aria-label="Close and go home" className="press grid h-10 w-10 shrink-0 place-items-center rounded-xl text-moss hover:bg-oat hover:text-ink">
          <X size={22} />
        </Link>
        <p className="mono text-[0.78rem] text-moss">Waitlist</p>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
        {done ? (
          <motion.section
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", duration: 0.6, bounce: 0.2 }}
            className="flex flex-col items-center text-center"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-porch text-white">
              <BellRing size={28} />
            </span>
            <h1 className="mt-6 text-[clamp(1.9rem,5vw,2.8rem)] font-extrabold leading-tight tracking-[-0.03em]" style={{ textWrap: "balance" }}>
              {done.again ? `Updated, ${done.firstName}.` : `You're on the list, ${done.firstName}.`}
            </h1>
            <p className="mt-4 max-w-md text-[1.05rem] text-ink/70" style={{ textWrap: "pretty" }}>
              We&apos;ll email {form.email.trim()} as soon as a bed opens{picked ? ` in ${picked.name}` : ""}. Beds go to whoever asks first, so reply quickly when it comes.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Link href="/tour" className="btn btn-primary press !h-12 !px-6">Book a tour meanwhile</Link>
              <Link href="/" className="btn btn-ghost press !h-12 !px-6">Back to home</Link>
            </div>
          </motion.section>
        ) : (
          <form onSubmit={submit}>
            <Q title="Hear when a bed opens." hint="Leave your email and we'll write the moment one does. No other emails, and you can leave the list any time.">
              {openBeds > 0 && !picked?.full && (
                <p className="mb-6 rounded-2xl bg-oat px-5 py-4 text-[0.98rem]">
                  {openBeds === 1 ? "One bed is" : `${openBeds} beds are`} open right now.{" "}
                  <Link href="/apply" className="font-semibold underline underline-offset-4">
                    Request a room
                  </Link>{" "}
                  instead of waiting.
                </p>
              )}
              <div className="grid gap-4">
                <Field label="Your name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" autoFocus />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" />
                  <Field label="Phone (optional)" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} autoComplete="tel" />
                </div>
                <fieldset>
                  <legend className="mb-2 block text-[0.92rem] font-medium text-ink/75">Which room?</legend>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <button type="button" aria-pressed={room === ""} onClick={() => setRoom("")} className={`${tile(room === "")} !py-4`}>
                      <span className="font-semibold">Any room</span>
                      <span className="text-[0.88rem] text-ink/60">Tell me about the first bed that opens</span>
                    </button>
                    {rooms.map((r) => (
                      <button key={r.slug} type="button" aria-pressed={room === r.slug} onClick={() => setRoom(r.slug)} className={`${tile(room === r.slug)} !py-4`}>
                        <span className="font-semibold">{r.name}</span>
                        <span className="text-[0.88rem] text-ink/60">{r.full ? "Full right now" : "Has a bed open or opening"}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 block text-[0.92rem] font-medium text-ink/75">Who&apos;s it for? (optional)</legend>
                  <div className="flex flex-wrap gap-2">
                    {PROGRAMS.map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={program === v}
                        onClick={() => setProgram(program === v ? undefined : v)}
                        className={`press h-11 rounded-xl px-4 text-[0.95rem] font-medium ring-1 transition-colors ${program === v ? "bg-porch/[.06] text-porch-deep ring-2 ring-porch" : "bg-paper ring-line hover:ring-line-strong"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
              {error && (
                <p role="alert" className="mt-6 text-[0.95rem] font-medium text-ember">
                  {error}
                </p>
              )}
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  disabled={!canSend || pending}
                  className="btn btn-primary press min-w-[12rem] disabled:opacity-35"
                >
                  {pending ? <Loader2 size={18} className="animate-spin" /> : "Add me to the waitlist"}
                </button>
                <a href={phone.href} className="mono text-center text-[0.92rem] text-ink/60 hover:text-ink sm:ml-3">
                  Or call {phone.label}
                </a>
              </div>
            </Q>
          </form>
        )}
      </main>
    </div>
  );
}
