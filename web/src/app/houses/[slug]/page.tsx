import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, MapPin, Phone } from "lucide-react";
import { getHouses, getRoomsWithBeds } from "@/lib/availability";
import type { RoomWithBeds } from "@/lib/types";
import { longDate, money, parseList } from "@/lib/format";
import { getHouse } from "@/lib/content";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { HouseGallery } from "@/components/house-gallery";
import { HouseAmenities } from "@/components/house-amenities";
import { availabilityText } from "@/components/room-card";
import { HouseCard, houseGrid, openText, priceLines, roomMix } from "@/components/house-card";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbLd, houseLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const [houses, rooms] = await Promise.all([getHouses(), getRoomsWithBeds()]);
  const home = houses.find((h) => h.slug === slug);
  return { home, houses, allRooms: rooms, rooms: home ? rooms.filter((r) => r.houseId === home.id) : [] };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const [{ home, rooms }, business] = await Promise.all([load((await params).slug), getHouse()]);
  if (!home) return { title: "House", robots: { index: false } };
  const where = home.town || business.town;
  const from = rooms.length ? ` From ${money(Math.min(...rooms.map((r) => r.rentCents)))} a month.` : "";
  const description = (home.summary || `A sober, shared house in ${where}.`) + ` ${roomMix(rooms)}.${from}`;
  const image = parseList(home.photos)[0] || "/images/hero/house-day.webp";
  return {
    title: `${home.name} · Sober shared house and rooms for rent in ${where}`,
    description,
    alternates: { canonical: `/houses/${home.slug}` },
    openGraph: { type: "website", url: `/houses/${home.slug}`, title: home.name, description, images: [{ url: image, alt: home.name }] },
    twitter: { card: "summary_large_image", title: home.name, description, images: [image] },
  };
}

const canRequest = (r: RoomWithBeds) => r.open > 0 || !!r.soon;
const bedWord = (n: number) => `${n} ${n === 1 ? "bed" : "beds"}`;
const Dot = ({ state }: { state: string }) => (
  <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${state === "open" ? "bg-porch" : state === "soon" ? "bg-porch/35" : "bg-line-strong"}`} />
);

function RoomRow({ room }: { room: RoomWithBeds }) {
  const features = parseList(room.features);
  const ask = canRequest(room);
  return (
    <li id={`room-${room.slug}`} className="scroll-mt-28 px-5 py-6 sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-[1.15rem] font-bold tracking-[-0.015em]">{room.name}</h3>
          <p className="mt-0.5 text-[0.92rem] text-ink/65">
            {room.kind === "PRIVATE" ? "Private room, just you" : `Shared room · ${bedWord(room.states.length)}`} · {room.floor === "Ground" ? "Ground floor" : "Upstairs"} · {room.bathroom} bathroom
          </p>
        </div>
        <p className="shrink-0 text-[0.98rem]">
          <span className="font-bold tabular-nums">{money(room.rentCents)}</span>
          <span className="text-moss"> / month{room.kind !== "PRIVATE" ? " per bed" : ""}</span>
        </p>
      </div>
      {room.summary && <p className="mt-3 max-w-2xl text-[0.95rem] text-ink/70">{room.summary}</p>}
      {features.length > 0 && <p className="mt-2 text-[0.88rem] text-moss">{features.join(" · ")}</p>}

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {room.states.map((b) => (
          <li key={b.label} className="flex items-center justify-between gap-3 rounded-xl bg-oat px-4 py-2.5">
            <span className="flex items-center gap-2.5">
              <Dot state={b.state} />
              <span className="text-[0.92rem] font-medium">{b.label}</span>
            </span>
            <span className={`text-[0.88rem] ${b.state === "open" ? "font-semibold text-porch" : "text-ink/60"}`}>
              {b.state === "open" ? "Open now" : b.state === "soon" ? `Opens ${longDate(b.availableFrom!)}` : "Taken"}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href={ask ? `/apply?room=${room.slug}` : `/waitlist?room=${room.slug}`} className={`btn press !h-11 px-5 ${ask ? "btn-primary" : "btn-ghost"}`}>
          {ask ? (room.kind === "PRIVATE" ? "Request this room" : "Request a bed") : "Join the waiting list"}
        </Link>
        <span className="text-[0.88rem] text-moss">{availabilityText(room)}</span>
      </div>
    </li>
  );
}

export default async function HousePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ home, houses, rooms, allRooms }, business] = await Promise.all([load((await params).slug), getHouse()]);
  if (!home) notFound();
  const photos = parseList(home.photos);
  const videos = parseList(home.videos);
  const prices = priceLines(rooms);
  const where = home.town || business.town;
  const others = houses.filter((h) => h.id !== home.id);
  const ordered = [...rooms].sort((a, b) => Number(b.open > 0) - Number(a.open > 0) || a.sortOrder - b.sortOrder);
  const anyOpen = rooms.some(canRequest);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Houses", path: "/houses" },
            { name: home.name, path: `/houses/${home.slug}` },
          ]),
          houseLd({ ...home, photos }, rooms),
        ]}
      />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1240px] px-4 pb-24 pt-6 sm:px-6">
        <Link href="/houses" className="press mb-5 inline-flex items-center gap-2 rounded-xl py-2 pr-3 text-[0.92rem] font-semibold text-moss hover:text-ink">
          <ArrowLeft size={16} /> {houses.length > 1 ? "All houses" : "Back"}
        </Link>

        <h1 className="text-[clamp(2rem,4vw,2.75rem)] font-extrabold tracking-[-0.03em]">{home.name}</h1>
        <p className="mt-2 flex items-start gap-2 text-moss">
          <MapPin size={15} className="mt-[0.3rem] shrink-0" />
          <span>
            {where} · {roomMix(rooms)} · {bedWord(home.beds)}
          </span>
        </p>

        <div className="mt-6">
          <HouseGallery name={home.name} photos={photos} />
        </div>

        <div className="mt-12 grid gap-14 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-12">
            {home.summary && <p className="max-w-2xl text-[1.1rem] leading-relaxed text-ink/80">{home.summary}</p>}

            {videos.length > 0 && (
              <section className="border-t border-line pt-10">
                <h2 className="mb-5 text-[1.3rem] font-extrabold tracking-[-0.02em]">{videos.length === 1 ? "Video tour" : "Video tours"}</h2>
                <div className="grid gap-4">
                  {videos.map((v, i) => (
                    <video key={v} src={v} controls playsInline preload="metadata" aria-label={`${home.name}, video ${i + 1}`} className="aspect-video w-full rounded-2xl bg-ink object-contain" />
                  ))}
                </div>
              </section>
            )}

            <section id="rooms" className="scroll-mt-24 border-t border-line pt-10">
              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 className="text-[1.3rem] font-extrabold tracking-[-0.02em]">Rooms and beds</h2>
                <p className="flex items-center gap-2 text-[0.92rem] text-ink/65">
                  {home.open > 0 && <Dot state="open" />} {openText(home)}
                </p>
              </div>
              {ordered.length ? (
                <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-paper ring-1 ring-line">
                  {ordered.map((r) => (
                    <RoomRow key={r.id} room={r} />
                  ))}
                </ul>
              ) : (
                <p className="rounded-2xl bg-oat px-6 py-8 text-moss">Rooms in this house are being set up. Join the waiting list and we will tell you when they open.</p>
              )}
              <p className="mt-4 text-[0.88rem] text-moss">A private room is yours alone. In a shared room you have your own bed and share the room with one or more housemates.</p>
            </section>

            <HouseAmenities keys={parseList(home.amenities)} />

            <section className="border-t border-line pt-10">
              <h2 className="mb-5 text-[1.3rem] font-extrabold tracking-[-0.02em]">Where it is</h2>
              <p className="flex items-center gap-2 text-ink/80">
                <MapPin size={16} /> {where}
              </p>
              <p className="mt-4 text-[0.95rem] text-moss">
                The exact address is shared when you{" "}
                <Link href={`/tour?house=${home.slug}`} className="font-medium text-ink underline underline-offset-4">
                  book a tour
                </Link>
                .
              </p>
            </section>
          </div>

          {/* Booking card */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-[20px] bg-paper p-6 shadow-[0_12px_40px_-12px_rgba(20,24,28,0.18)] ring-1 ring-line">
              {prices.length > 0 ? (
                <ul className="grid gap-1">
                  {prices.map((p) => (
                    <li key={p.label} className="flex items-baseline justify-between gap-3">
                      <span className="text-moss">{p.label}</span>
                      <span>
                        {p.from && <span className="text-[0.9rem] text-moss">from </span>}
                        <span className="text-[1.35rem] font-extrabold tabular-nums">{p.amount}</span>
                        <span className="text-[0.9rem] text-moss"> / month</span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-bold">Prices coming soon</p>
              )}
              <p className="mt-2 text-[0.9rem] text-moss">{roomMix(rooms)}</p>

              <div className="my-5 flex items-center gap-3 rounded-xl bg-oat px-4 py-3">
                <Dot state={home.open ? "open" : "taken"} />
                <span className="text-[0.95rem] font-semibold">{openText(home)}</span>
              </div>

              <Link href={anyOpen ? "#rooms" : "/waitlist"} className="btn btn-primary press !h-12 w-full">
                {anyOpen ? "Pick a room" : "Join the waiting list"}
              </Link>
              <Link href={`/tour?house=${home.slug}`} className="btn btn-ghost press mt-2.5 !h-12 w-full">
                <CalendarDays size={15} /> Book a tour
              </Link>
              <a href={business.phoneHref} className="press mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-[0.9rem] font-semibold text-moss hover:text-ink">
                <Phone size={14} /> {business.phone}
              </a>
              <p className="mt-4 text-center text-[0.85rem] text-moss">Requesting is free. We will call you before anything is final.</p>
            </div>
          </aside>
        </div>

        {others.length > 0 && (
          <section className="mt-20 border-t border-line pt-12">
            <h2 className="mb-6 text-[1.5rem] font-extrabold tracking-[-0.02em]">Other houses</h2>
            <div className={houseGrid(others.length)}>
              {others.slice(0, 4).map((h) => (
                <HouseCard key={h.id} house={h} rooms={allRooms.filter((r) => r.houseId === h.id)} />
              ))}
            </div>
          </section>
        )}
      </main>
      {/* phones: the price and the next step stay in reach */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[640px] items-center justify-between gap-4">
          <div className="min-w-0">
            {prices.length > 0 && (
              <p className="leading-tight">
                <span className="text-[0.85rem] text-moss">{prices[0].label} {prices[0].from ? "from " : ""}</span>
                <span className="font-bold tabular-nums">{prices[0].amount}</span>
                <span className="text-[0.9rem] text-moss"> / month</span>
              </p>
            )}
            <p className="truncate text-[0.82rem] text-moss">{openText(home)}</p>
          </div>
          <Link href={anyOpen ? "#rooms" : "/waitlist"} className="btn btn-primary press !h-12 shrink-0 px-6">
            {anyOpen ? "See rooms" : "Waiting list"}
          </Link>
        </div>
      </div>
      <SiteFooter />
      <div className="h-20 bg-oat lg:hidden" aria-hidden />
    </>
  );
}
