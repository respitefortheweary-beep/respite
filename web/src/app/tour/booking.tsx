"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X, ArrowLeft, Loader2, CalendarCheck, CalendarPlus, MapPin } from "lucide-react";
import { Q, Field, tile } from "../apply/flow";
import { bookTour, tourSlots, type Program } from "./actions";
import { clock, dayChip, longDay } from "@/lib/when";
import { tourCalendar } from "@/lib/calendar";
import { HouseImage } from "@/components/room-art";

type Day = { date: string; times: string[] };
type Phone = { label: string; href: string };
/** A house visitors can choose to see. */
export type TourHouse = { slug: string; name: string; town: string; photos: string[]; open: number; beds: number };
type Step = "house" | "when" | "you";

const PROGRAMS: [Program, string][] = [
  ["VETERAN", "Veteran"],
  ["RECOVERY", "In recovery"],
  ["SENIOR", "Independent senior"],
];

export function Booking({
  days: initialDays,
  phone,
  address: fallbackAddress,
  houses,
  chosen,
}: {
  days: Day[];
  phone: Phone;
  address: string;
  houses: TourHouse[];
  /** the house they came from, when they pressed "Book a tour" on its page */
  chosen?: string;
}) {
  const [days, setDays] = useState(initialDays);
  const [date, setDate] = useState(initialDays[0]?.date ?? "");
  const [time, setTime] = useState("");
  // one house: nothing to choose. Several: ask first, unless they came from a house's page
  const preset = houses.length === 1 ? houses[0].slug : houses.find((h) => h.slug === chosen)?.slug;
  const [houseSlug, setHouseSlug] = useState(preset ?? "");
  const [step, setStep] = useState<Step>(houses.length > 1 && !preset ? "house" : "when");
  const [form, setForm] = useState({ name: "", phone: "", email: "", note: "" });
  const [program, setProgram] = useState<Program | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ firstName: string; when: string; email: boolean; address: string; cal: ReturnType<typeof tourCalendar> } | null>(null);
  const [pending, start] = useTransition();
  const reduce = useReducedMotion();

  const day = days.find((d) => d.date === date);
  const house = houses.find((h) => h.slug === houseSlug);
  const choosing = houses.length > 1;
  const first: Step = choosing ? "house" : "when";
  const back = () => {
    setError(null);
    setStep(step === "you" ? "when" : first);
  };
  const canSend = form.name.trim().length >= 2 && form.phone.replace(/\D/g, "").length >= 7;

  function submit() {
    setError(null);
    start(async () => {
      const res = await bookTour({ date, time, ...form, email: form.email.trim() || undefined, note: form.note.trim() || undefined, program, house: house?.slug });
      if (res.ok) {
        // the street address is only shared once they've booked
        const address = res.house?.address || fallbackAddress;
        setDone({
          address,
          firstName: res.firstName,
          when: res.when,
          email: !!form.email.trim(),
          cal: tourCalendar({ token: res.token, startsAt: res.startsAt, endsAt: res.endsAt, address, phone: phone.label }),
        });
        return;
      }
      setError(res.error);
      if (res.taken) {
        // someone else got there first: show what's left and send them back to choose
        const fresh = await tourSlots().catch(() => null);
        if (fresh) setDays(fresh.days);
        setTime("");
        setStep("when");
      }
    });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 pt-5 sm:px-6">
        <Link href="/" aria-label="Close and go home" className="press grid h-10 w-10 shrink-0 place-items-center rounded-xl text-moss hover:bg-oat hover:text-ink">
          <X size={22} />
        </Link>
        <p className="mono text-[0.78rem] text-moss">Book a tour</p>
      </header>

      <main id="main" className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pb-36 pt-10 sm:px-6 sm:pt-16">
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.section
              key="done"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", duration: 0.6, bounce: 0.2 }}
              className="flex flex-col items-center text-center"
            >
              <span className="grid h-16 w-16 place-items-center rounded-full bg-porch text-white">
                <CalendarCheck size={28} />
              </span>
              <h1 className="mt-6 text-[clamp(1.9rem,5vw,2.8rem)] font-extrabold leading-tight tracking-[-0.03em]" style={{ textWrap: "balance" }}>
                See you {done.when}.
              </h1>
              <p className="mt-4 max-w-md text-[1.05rem] text-ink/70" style={{ textWrap: "pretty" }}>
                {done.email ? "We emailed the details and a link to cancel if plans change. You'll get a reminder the day before." : "We'll call the day before to confirm."}{" "}
                {house && choosing ? `${house.name} is at ${done.address}.` : `The house is at ${done.address}.`} Questions? Call{" "}
                <a href={phone.href} className="font-semibold text-ink underline underline-offset-4">
                  {phone.label}
                </a>
                .
              </p>
              <div className="mt-8 flex flex-col items-center gap-2">
                <p className="mono text-[0.8rem] text-moss">Add it to your calendar</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <a href={done.cal.google} target="_blank" rel="noopener noreferrer" className="btn btn-ghost press !h-11 !px-5">
                    <CalendarPlus size={16} /> Google Calendar
                  </a>
                  <a href={done.cal.ics} className="btn btn-ghost press !h-11 !px-5">
                    <CalendarPlus size={16} /> Apple or Outlook
                  </a>
                </div>
              </div>
              <div className="mt-9 flex flex-wrap justify-center gap-3">
                <Link href="/houses" className="btn btn-primary press !h-12 !px-6">Look at houses</Link>
                <Link href="/" className="btn btn-ghost press !h-12 !px-6">Back to home</Link>
              </div>
            </motion.section>
          ) : (
            <motion.div
              key={step}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: step === first ? -40 : 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: step === first ? 40 : -40 }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            >
              {step === "house" ? (
                <Q title="Which house would you like to see?" hint="Pick one and we'll show you around it. You can ask about the others while you're there.">
                  <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="House">
                    {houses.map((h) => {
                      const on = h.slug === houseSlug;
                      return (
                        <button
                          key={h.slug}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setHouseSlug(h.slug)}
                          className={`${tile(on)} !flex-row !items-center gap-4 !p-3 text-left`}
                        >
                          <span className="relative h-[4.5rem] w-[5.5rem] shrink-0 overflow-hidden rounded-xl bg-oat">
                            <HouseImage photos={h.photos} alt="" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[1.08rem] font-semibold tracking-[-0.02em]">{h.name}</span>
                            {h.town && <span className="block truncate text-[0.9rem] text-ink/65">{h.town}</span>}
                            <span className="mono mt-1 block text-[0.74rem] text-moss">
                              {!h.beds ? "Opening soon" : h.open ? `${h.open} ${h.open === 1 ? "bed" : "beds"} open` : "Full right now"}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </Q>
              ) : step === "when" ? (
                <Q
                  title="When would you like to visit?"
                  hint={
                    house && choosing ? (
                      <>
                        <span className="inline-flex flex-wrap items-center gap-x-1.5 font-medium text-ink">
                          <MapPin size={15} className="text-moss" /> {house.name}
                          {house.town && <span className="font-normal text-ink/65">· {house.town}</span>}
                          <button type="button" onClick={() => setStep("house")} className="ml-1 font-medium text-ink/65 underline underline-offset-4 hover:text-ink">
                            Change
                          </button>
                        </span>
                        <br />A tour takes about half an hour. You&apos;ll see the rooms, the kitchen and the porch.
                      </>
                    ) : (
                      "A tour takes about half an hour. You'll see the rooms, the kitchen and the porch."
                    )
                  }
                >
                  {days.length === 0 ? (
                    <p className="rounded-2xl bg-oat p-5 text-[1.02rem]">
                      Every time is taken right now. Call{" "}
                      <a href={phone.href} className="font-semibold underline underline-offset-4">
                        {phone.label}
                      </a>{" "}
                      and we&apos;ll find one that works.
                    </p>
                  ) : (
                    <>
                      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" role="radiogroup" aria-label="Day">
                        <div className="flex gap-2.5">
                          {days.map((d) => {
                            const c = dayChip(d.date);
                            const on = d.date === date;
                            return (
                              <button
                                key={d.date}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                aria-label={longDay(d.date)}
                                onClick={() => {
                                  setDate(d.date);
                                  setTime("");
                                }}
                                className={`${tile(on)} !w-[4.6rem] shrink-0 !items-center !px-2 !py-3.5 text-center`}
                              >
                                <span className="mono text-[0.8rem] text-ink/60">{c.weekday}</span>
                                <span className="mt-0.5 text-[1.5rem] font-semibold leading-none tabular">{c.day}</span>
                                <span className="mt-1 text-[0.78rem] text-ink/60">{c.month}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {day && (
                        <div className="mt-8">
                          <p className="mb-3 text-[0.95rem] font-medium text-ink/75">{longDay(day.date)}</p>
                          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="radiogroup" aria-label="Time">
                            {day.times.map((t) => (
                              <button
                                key={t}
                                type="button"
                                role="radio"
                                aria-checked={time === t}
                                onClick={() => setTime(t)}
                                className={`${tile(time === t)} !items-center !py-4 text-[1.05rem] font-semibold tabular`}
                              >
                                {clock(t)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </Q>
              ) : (
                <Q
                  title="Who's coming?"
                  hint={`${house && choosing ? `${house.name}, ` : ""}${longDay(date)} at ${clock(time)}. Bring anyone you like: family, a case manager, a friend.`}
                >
                  <div className="grid gap-4">
                    <Field label="Your name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="name" autoFocus />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Phone" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} autoComplete="tel" />
                      <Field label="Email (for the reminder)" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="email" />
                    </div>
                    <fieldset>
                      <legend className="mb-2 block text-[0.92rem] font-medium text-ink/75">Who&apos;s the room for? (optional)</legend>
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
                    <label className="block">
                      <span className="mb-2 block text-[0.92rem] font-medium text-ink/75">Anything we should know? (optional)</span>
                      <textarea
                        value={form.note}
                        onChange={(e) => setForm({ ...form, note: e.target.value })}
                        rows={3}
                        maxLength={1000}
                        placeholder="Coming with a family member, need a ramp, running late…"
                        className="w-full resize-none rounded-2xl bg-paper p-5 text-[1.05rem] ring-1 ring-line outline-none transition-shadow placeholder:text-ink/60 focus:ring-2 focus:ring-porch"
                      />
                    </label>
                  </div>
                </Q>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {!done && days.length > 0 && (
        <footer className="fixed inset-x-0 bottom-0 border-t border-line bg-white/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <button type="button" onClick={back} disabled={step === first} className="btn btn-ghost press disabled:invisible">
              <ArrowLeft size={16} /> Back
            </button>
            <div className="flex min-w-0 flex-1 items-center justify-end gap-4">
              {error && (
                <p role="alert" className="min-w-0 text-right text-[0.9rem] font-medium text-ember">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={step === "you" ? submit : () => { setError(null); setStep(step === "house" ? "when" : "you"); }}
                disabled={(step === "house" ? !house : step === "when" ? !time : !canSend) || pending}
                className="btn btn-primary press min-w-[9.5rem] shrink-0 disabled:opacity-35"
              >
                {pending ? <Loader2 size={18} className="animate-spin" /> : step === "you" ? "Book the tour" : "Continue"}
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
