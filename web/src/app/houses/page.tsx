import Link from "next/link";
import type { Metadata } from "next";
import { getHouses, getRoomsWithBeds } from "@/lib/availability";
import { getHouse } from "@/lib/content";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { HouseCard } from "@/components/house-card";
import { Reveal } from "@/components/reveal";
import { townsText } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const [houses, business] = await Promise.all([getHouses().catch(() => []), getHouse()]);
  const where = townsText(houses.map((h) => h.town), business.town);
  return {
    title: "Houses and open beds",
    description: `Sober, supportive shared houses in ${where}. Single and shared rooms, rent per bed space, and which beds are open tonight.`,
    alternates: { canonical: "/houses" },
  };
}

export default async function HousesPage() {
  const [houses, rooms, business] = await Promise.all([getHouses(), getRoomsWithBeds(), getHouse()]);
  const open = houses.reduce((n, h) => n + h.open, 0);
  const where = townsText(houses.map((h) => h.town), business.town);

  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1240px] px-4 pb-28 sm:px-6">
        <div className="pb-10 pt-12 sm:pt-16">
          <h1 className="display text-[clamp(2.4rem,5vw,4rem)]">{houses.length === 1 ? "Our house" : "Our houses"}</h1>
          <p className="mt-3 max-w-2xl text-ink/65">
            {where} · {houses.length} {houses.length === 1 ? "house" : "houses"} ·{" "}
            <span className="font-semibold text-ink">
              {open} bed {open === 1 ? "space" : "spaces"} open
            </span>
          </p>
          <p className="mt-2 max-w-2xl text-[0.95rem] text-ink/60">Open a house to see its photos, its rooms, and which beds are free now or opening soon.</p>
        </div>

        {houses.length ? (
          <div className="grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {houses.map((h, i) => (
              <Reveal key={h.id} delay={i * 60}>
                <HouseCard house={h} rooms={rooms.filter((r) => r.houseId === h.id)} priority={i < 3} />
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="rounded-[28px] bg-paper p-10 text-center ring-1 ring-line sm:p-16">
            <p className="display text-3xl">New houses are on the way.</p>
            <p className="mx-auto mt-3 max-w-md text-ink/65">Join the waitlist and we&apos;ll call you when a bed opens.</p>
            <Link href="/waitlist" className="btn btn-primary press mt-7">
              Join the waitlist
            </Link>
          </div>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
