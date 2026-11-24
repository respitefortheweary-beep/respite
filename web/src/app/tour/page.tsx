import type { Metadata } from "next";
import Link from "next/link";
import { Phone, X } from "lucide-react";
import { api } from "@/lib/api";
import { getHouse } from "@/lib/content";
import { getHouses } from "@/lib/availability";
import { parseList } from "@/lib/format";
import { getWhere } from "@/lib/where";
import { Booking, type TourHouse } from "./booking";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Book a tour", description: `Pick a time to visit a house in ${await getWhere()} and see the rooms before you decide.`, alternates: { canonical: "/tour" } };
}
export const dynamic = "force-dynamic";

type Slots = { enabled: boolean; days: { date: string; times: string[] }[] };

export default async function TourPage({ searchParams }: { searchParams: Promise<{ house?: string | string[] }> }) {
  const [slots, house, listed, params] = await Promise.all([
    api.get<Slots>("/public/tours/slots").catch((): Slots => ({ enabled: false, days: [] })),
    getHouse(),
    getHouses().catch(() => []),
    searchParams,
  ]);
  const phone = { label: house.phone, href: house.phoneHref };
  const houses: TourHouse[] = listed.map((h) => ({ slug: h.slug, name: h.name, town: h.town, photos: parseList(h.photos), open: h.open, beds: h.beds }));
  const chosen = typeof params.house === "string" ? params.house : undefined;
  if (slots.enabled) return <Booking days={slots.days} phone={phone} address={house.address} houses={houses} chosen={chosen} />;
  const picked = houses.length > 1 ? houses.find((h) => h.slug === chosen) : undefined;

  // no weekly times set yet: tours are by phone
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 pt-5 sm:px-6">
        <Link href="/" aria-label="Close and go home" className="press grid h-10 w-10 shrink-0 place-items-center rounded-xl text-moss hover:bg-oat hover:text-ink">
          <X size={22} />
        </Link>
      </header>
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-10 sm:px-6 sm:pt-16">
        <h1 className="text-[clamp(1.8rem,4.5vw,2.6rem)] font-extrabold leading-tight tracking-[-0.03em]" style={{ textWrap: "balance" }}>
          {picked ? <>Come and see {picked.name}.</> : <>Come and see where you&apos;d live.</>}
        </h1>
        <p className="mt-4 max-w-xl text-[1.05rem] text-ink/65" style={{ textWrap: "pretty" }}>
          Call and we&apos;ll set up a time that works for you{picked ? ` to tour ${picked.name}` : ""}. {house.tourNote}
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <a href={house.phoneHref} className="btn btn-primary press mono !h-12 !px-6">
            <Phone size={16} /> {house.phone}
          </a>
          <Link href="/apply" className="btn btn-ghost press !h-12 !px-6">
            Request a room instead
          </Link>
        </div>
      </main>
    </div>
  );
}
