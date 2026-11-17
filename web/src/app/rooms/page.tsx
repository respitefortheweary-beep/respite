import Link from "next/link";
import type { Metadata } from "next";
import { X } from "lucide-react";
import { getHouses, getRoomsWithBeds } from "@/lib/availability";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { SearchBar } from "@/components/search-bar";
import { RoomCard } from "@/components/room-card";
import { Reveal } from "@/components/reveal";

export const metadata: Metadata = { title: "Rooms and availability" };
export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

const CHIPS: { key: string; label: string; value: string }[] = [
  { key: "stairs", label: "No stairs", value: "none" },
  { key: "bath", label: "Private bathroom", value: "private" },
  { key: "max", label: "Under $700", value: "70000" },
];

export default async function RoomsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [all, houses] = await Promise.all([getRoomsWithBeds(), getHouses()]);
  const several = houses.length > 1;
  const picked = several ? houses.find((h) => h.slug === sp.house) : undefined;
  const in60 = Date.now() + 60 * 86400000;

  let rooms = all.filter((r) => {
    if (picked && r.houseId !== picked.id) return false;
    if (sp.kind && r.kind !== sp.kind) return false;
    if (sp.when === "now" && r.open === 0) return false;
    if (sp.when === "soon" && r.open === 0 && !(r.soon && r.soon.getTime() < in60)) return false;
    if (sp.stairs === "none" && r.floor !== "Ground") return false;
    if (sp.bath === "private" && r.bathroom !== "Private") return false;
    if (sp.max && r.rentCents > Number(sp.max)) return false;
    return true;
  });
  // Seniors see ground-floor rooms first; everyone sees open rooms before full ones.
  rooms = rooms.sort(
    (a, b) =>
      Number(b.open > 0) - Number(a.open > 0) ||
      (sp.program === "SENIOR" ? Number(b.floor === "Ground") - Number(a.floor === "Ground") : 0) ||
      a.sortOrder - b.sortOrder,
  );

  const href = (patch: SP) => {
    const q = new URLSearchParams();
    Object.entries({ ...sp, ...patch }).forEach(([k, v]) => v && q.set(k, v));
    return `/rooms${q.size ? `?${q}` : ""}`;
  };
  const activeCount = ["kind", "when", "stairs", "bath", "max", "program", "house"].filter((k) => sp[k]).length;
  const openBeds = (picked ? all.filter((r) => r.houseId === picked.id) : all).reduce((n, r) => n + r.open, 0);
  const total = picked ? all.filter((r) => r.houseId === picked.id).length : all.length;
  // with more than one house and none picked, rooms are listed under their house
  const groups = several && !picked ? houses.map((h) => ({ house: h, rooms: rooms.filter((r) => r.houseId === h.id) })).filter((g) => g.rooms.length) : null;
  const town = (picked ?? houses[0])?.town;

  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1240px] px-4 pb-28 sm:px-6">
        <div className="sticky top-16 z-30 -mx-4 border-b border-line bg-oat/85 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6">
          <div className="flex justify-center">
            <SearchBar compact initial={{ program: sp.program ?? "", kind: sp.kind ?? "", when: sp.when ?? "" }} />
          </div>
          <div className="no-scrollbar mx-auto mt-4 flex max-w-3xl gap-2 overflow-x-auto">
            {several &&
              houses.map((h) => {
                const on = picked?.id === h.id;
                return (
                  <Link
                    key={h.id}
                    href={href({ house: on ? undefined : h.slug })}
                    scroll={false}
                    aria-pressed={on}
                    className={`press shrink-0 rounded-full px-4 py-2 text-[0.9rem] font-medium ring-1 ${
                      on ? "bg-ink text-paper ring-ink" : "bg-paper text-ink ring-line hover:ring-line-strong"
                    }`}
                  >
                    {h.name}
                  </Link>
                );
              })}
            {several && <span aria-hidden className="my-1.5 w-px shrink-0 bg-line-strong" />}
            {CHIPS.map((c) => {
              const on = sp[c.key] === c.value;
              return (
                <Link
                  key={c.key}
                  href={href({ [c.key]: on ? undefined : c.value })}
                  scroll={false}
                  aria-pressed={on}
                  className={`press shrink-0 rounded-full px-4 py-2 text-[0.9rem] font-medium ring-1 ${
                    on ? "bg-ink text-paper ring-ink" : "bg-paper text-ink ring-line hover:ring-line-strong"
                  }`}
                >
                  {c.label}
                </Link>
              );
            })}
            {activeCount > 0 && (
              <Link href="/rooms" scroll={false} className="press inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[0.9rem] font-medium text-ink/60 hover:text-ink">
                <X size={14} /> Clear all
              </Link>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 pb-8 pt-12">
          <div>
            <h1 className="display text-[clamp(2.4rem,5vw,4rem)]">{picked ? picked.name : several ? "Rooms and availability" : `Rooms in ${town || "Chester, VA"}`}</h1>
            <p className="mt-3 text-ink/65">
              {picked?.town ? `${picked.town} · ` : ""}
              {rooms.length} of {total} rooms match ·{" "}
              <span className="font-semibold text-ink">
                {openBeds} {openBeds === 1 ? "bed" : "beds"} open {several && !picked ? `across ${houses.length} houses` : "in the house"}
              </span>
            </p>
          </div>
        </div>

        {groups?.length ? (
          <div className="grid gap-20">
            {groups.map((g, gi) => (
              <section key={g.house.id} aria-labelledby={`h-${g.house.id}`}>
                <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line pb-4">
                  <h2 id={`h-${g.house.id}`} className="text-[1.6rem] font-semibold tracking-[-0.035em]">
                    {g.house.name}
                  </h2>
                  <p className="mono text-[0.8rem] uppercase tracking-[0.02em] text-moss">
                    {g.house.town ? `${g.house.town} · ` : ""}
                    {g.house.open} of {g.house.beds} beds open
                  </p>
                </div>
                <div className="grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                  {g.rooms.map((r, i) => (
                    <Reveal key={r.id} delay={i * 60}>
                      <RoomCard room={r} priority={gi === 0 && i < 3} />
                    </Reveal>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : rooms.length ? (
          <div className="grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r, i) => (
              <Reveal key={r.id} delay={i * 60}>
                <RoomCard room={r} priority={i < 3} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] bg-paper p-10 text-center ring-1 ring-line sm:p-16">
            <p className="display text-3xl">No rooms match those filters.</p>
            <p className="mx-auto mt-3 max-w-md text-ink/65">
              Remove a filter to see more, or send a request anyway. We keep a waitlist and call when a bed opens.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/rooms" className="btn btn-ghost press">Clear filters</Link>
              <Link href="/waitlist" className="btn btn-primary press">Join the waitlist</Link>
            </div>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
