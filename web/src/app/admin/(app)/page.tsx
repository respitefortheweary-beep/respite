import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { admin } from "@/lib/api";
import type { BedView, Charge, Property, Request, Resident, Room } from "@/lib/types";
import { money, timeAgo, shortDate } from "@/lib/format";
import { PROGRAMS, type Program } from "@/lib/labels";
import { Card, CardHead, Empty, StatusPill, ChargePill, isOverdue } from "./ui";

export default async function Overview() {
  const now = new Date();
  const { beds, houses = [], requests: active, due, collectedThisMonthCents } = await admin.get<{
    beds: BedView[];
    houses?: Property[];
    requests: (Request & { room: Room | null })[];
    due: (Charge & { resident: Resident })[];
    collectedThisMonthCents: number;
  }>("/admin/overview");
  const open = beds.filter((b) => b.state === "open").length;
  const several = houses.length > 1;
  const fresh = active.filter((r) => r.status === "NEW").length;
  const owed = due.reduce((n, c) => n + c.amountCents, 0);
  const late = due.filter(isOverdue);
  const lateTotal = late.reduce((n, c) => n + c.amountCents, 0);
  const hour = Number(now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" }));
  const greeting = hour < 12 ? "Good morning." : hour < 18 ? "Good afternoon." : "Good evening.";
  const today = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/New_York" });

  // one plain sentence about what needs attention, most urgent first
  const next = fresh
    ? { text: `${fresh} new ${fresh === 1 ? "request is" : "requests are"} waiting for a call back.`, href: "/admin/requests", cta: "Open requests" }
    : late.length
      ? { text: `${money(lateTotal)} is past due from ${new Set(late.map((c) => c.residentId)).size === 1 ? late[0].resident.name.split(" ")[0] : `${new Set(late.map((c) => c.residentId)).size} residents`}.`, href: "/admin/payments", cta: "Open payments" }
      : open
        ? { text: `${open} ${open === 1 ? "bed is" : "beds are"} open and showing on the site.`, href: "/admin/houses", cta: "Houses" }
        : { text: `${several ? "Every house" : "The house"} is full and everyone is paid up.`, href: "/admin/residents", cta: "Residents" };

  const facts: [string, string, string][] = [
    ["Open beds", `${open}/${beds.length}`, "/admin/houses"],
    ["Active requests", String(active.length), "/admin/requests"],
    ["Waiting to be paid", money(owed), "/admin/payments"],
    ["Collected this month", money(collectedThisMonthCents), "/admin/payments?tab=paid"],
  ];

  return (
    <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1240px] px-4 pb-16 pt-4 sm:px-8 md:pt-8">
      {/* Today at a glance */}
      <section className="overflow-hidden rounded-[20px] bg-white ring-1 ring-line">
        <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_minmax(280px,400px)]">
          <div>
            <p className="text-[0.85rem] font-semibold text-porch">{today}</p>
            <h1 className="mt-2 text-[clamp(1.9rem,4vw,2.6rem)] font-extrabold leading-tight tracking-[-0.03em]">{greeting}</h1>
            <p className="mt-2 max-w-md text-[1.02rem] leading-snug text-moss">{next.text}</p>
            <Link href={next.href} className="btn btn-primary press mt-5">
              {next.cta} <ArrowRight size={16} />
            </Link>
          </div>
          <Houses houses={houses} />
        </div>
        <dl className="grid grid-cols-2 border-t border-line bg-oat/50 md:grid-cols-4">
          {facts.map(([k, v, href], i) => (
            <Link
              key={k}
              href={href}
              className={`group p-5 transition-colors hover:bg-oat sm:px-8 ${i % 2 ? "border-l border-line" : ""} ${i > 1 ? "border-t border-line md:border-t-0" : ""} ${i === 2 ? "md:border-l" : ""}`}
            >
              <dt className="text-[0.85rem] text-moss">{k}</dt>
              <dd className="tabular mt-1 text-[1.5rem] font-extrabold tracking-[-0.03em]">{v}</dd>
            </Link>
          ))}
        </dl>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_270px]">
        <Card>
          <CardHead title="Requests to follow up" action={<Link href="/admin/requests" className="text-[0.86rem] text-moss hover:text-ink">See all</Link>} />
          {active.length ? (
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {active.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/requests/${r.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-ink/[.025] sm:px-6">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.name}</span>
                      <span className="block truncate text-[0.85rem] text-moss">
                        {PROGRAMS[r.program as Program]?.long ?? "Not said"} · {r.room?.name.replace("The ", "") ?? "Any room"} · {timeAgo(r.createdAt)}
                      </span>
                    </span>
                    <StatusPill status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No open requests. New ones land here and in your email.</Empty>
          )}
        </Card>

        <Card>
          <CardHead title="Waiting to be paid" action={<Link href="/admin/payments" className="text-[0.86rem] text-moss hover:text-ink">Payments</Link>} />
          {due.length ? (
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {due.slice(0, 5).map((c) => (
                <li key={c.id}>
                  <Link href={`/admin/residents/${c.residentId}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-ink/[.025] sm:px-6">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.resident.name}</span>
                      <span className="block truncate text-[0.85rem] text-moss">
                        {c.label} · due {shortDate(c.dueDate)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="mono tabular block text-[0.95rem] font-medium">{money(c.amountCents)}</span>
                      {isOverdue(c) && <ChargePill status={c.status} dueDate={c.dueDate} />}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Everyone is paid up.</Empty>
          )}
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHead title="Beds" action={<Link href="/admin/houses" className="text-[0.86rem] text-moss hover:text-ink">Manage</Link>} />
          <ul className="mt-3 grid sm:grid-cols-2 xl:grid-cols-1">
            {beds.map((b, i) => (
              <li key={b.id} className="contents">
                {several && b.houseId !== beds[i - 1]?.houseId && (
                  <p className="border-t border-line bg-oat px-5 py-2 text-[0.8rem] font-semibold text-moss sm:col-span-2 sm:px-6 xl:col-span-1">{b.houseName}</p>
                )}
                <div className="flex items-center gap-3 border-t border-line px-5 py-3 text-[0.92rem] sm:px-6">
                <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${b.state === "open" ? "bg-porch" : b.state === "soon" ? "bg-porch/35" : "bg-line-strong"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{b.state === "open" ? "Open" : b.residentName}</span>
                  <span className="block truncate text-[0.8rem] text-moss">
                    {b.label} · {b.roomName.replace("The ", "")}
                  </span>
                </span>
                {b.state === "soon" && <span className="mono text-[0.76rem] text-moss">opens {shortDate(b.availableFrom!)}</span>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </main>
  );
}

/** Each house with a bar showing how many of its beds are free. */
function Houses({ houses }: { houses: Property[] }) {
  return (
    <ul className="grid content-start gap-2">
      {houses.map((h) => {
        const n = h.beds || 1;
        const soon = h.states.filter((st) => st === "soon").length;
        return (
          <li key={h.id}>
            <Link href={`/admin/houses#house-${h.id}`} className="block rounded-xl bg-oat px-4 py-3 transition-colors hover:bg-line">
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate text-[0.95rem] font-semibold">{h.name}</span>
                <span className="tabular shrink-0 text-[0.82rem] text-moss">
                  {h.beds ? `${h.open} of ${h.beds} free` : "No beds yet"}
                  {h.hidden ? " · hidden" : ""}
                </span>
              </span>
              <span className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-line-strong/50" aria-hidden>
                <span className="bg-porch" style={{ width: `${(h.open / n) * 100}%` }} />
                <span className="bg-porch/35" style={{ width: `${(soon / n) * 100}%` }} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
