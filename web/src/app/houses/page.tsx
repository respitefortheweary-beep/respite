import Link from "next/link";
import type { Metadata } from "next";
import { getHouses, getRoomsWithBeds } from "@/lib/availability";
import { getHouse } from "@/lib/content";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { HouseCard, houseGrid } from "@/components/house-card";
import { HouseSearch, matchHouse, type SearchValues } from "@/components/house-search";
import { townsText } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [houses, business] = await Promise.all([getHouses().catch(() => []), getHouse()]);
  const where = townsText(houses.map((h) => h.town), business.town);
  return {
    title: "Houses and open beds",
    description: `Sober, supportive shared houses in ${where}. Rent a bed in a shared room or a private room, and see which beds are free now.`,
    alternates: { canonical: "/houses" },
  };
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function HousesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [params, houses, rooms, business] = await Promise.all([searchParams, getHouses(), getRoomsWithBeds(), getHouse()]);
  const q: SearchValues = { town: one(params.town), from: one(params.from), rent: one(params.rent), who: one(params.who) };
  const filtered = Boolean(q.town || q.from || q.rent);
  const shown = houses.filter((h) => matchHouse(h, rooms, q)).sort((a, b) => Number(b.open > 0) - Number(a.open > 0));
  const open = shown.reduce((n, h) => n + h.open, 0);
  const where = townsText(houses.map((h) => h.town), business.town);

  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="pb-24 outline-none">
        <div className="border-b border-line bg-oat">
          <div className="mx-auto max-w-[1240px] px-4 pb-10 pt-10 sm:px-6 sm:pt-14">
            <h1 className="text-[clamp(2rem,4vw,2.75rem)] font-extrabold tracking-[-0.03em]">Houses and open beds</h1>
            <p className="mt-2 text-moss">
              {where} · {houses.length} {houses.length === 1 ? "house" : "houses"}. Furnished, with utilities and Wi‑Fi included. Rent is paid monthly.
            </p>
            <HouseSearch towns={houses.map((h) => h.town)} values={q} className="mt-7" />
          </div>
        </div>

        <div className="mx-auto max-w-[1240px] px-4 pt-10 sm:px-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold">
              {shown.length} {shown.length === 1 ? "house" : "houses"}
              <span className="font-normal text-moss"> · {open} {open === 1 ? "bed" : "beds"} free</span>
            </p>
            {filtered && (
              <Link href="/houses" className="text-[0.92rem] font-semibold text-porch hover:text-porch-deep">
                Clear search
              </Link>
            )}
          </div>

          {shown.length ? (
            <div className={houseGrid(shown.length)}>
              {shown.map((h, i) => (
                <HouseCard key={h.id} house={h} rooms={rooms.filter((r) => r.houseId === h.id)} priority={i < 4} />
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] bg-oat p-10 text-center sm:p-14">
              <p className="text-[1.5rem] font-extrabold tracking-[-0.02em]">{filtered ? "No house matches that search." : "New houses are on the way."}</p>
              <p className="mx-auto mt-2 max-w-md text-moss">Join the waiting list and we will tell you as soon as a bed is free.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link href="/waitlist" className="btn btn-primary press">Join the waiting list</Link>
                {filtered && <Link href="/houses" className="btn btn-ghost press">See every house</Link>}
              </div>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
