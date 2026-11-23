import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarDays, MapPin, Phone } from "lucide-react";
import { getHouses, getRoomsWithBeds } from "@/lib/availability";
import type { RoomWithBeds } from "@/lib/types";
import { longDate, money, parseList } from "@/lib/format";
import { getHouse } from "@/lib/content";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { HouseImage } from "@/components/room-art";
import { HouseGallery } from "@/components/house-gallery";
import { WindowRow } from "@/components/house";
import { availabilityText } from "@/components/room-card";
import { openText, roomMix } from "@/components/house-card";
import { Reveal } from "@/components/reveal";
import { JsonLd } from "@/components/json-ld";
import { breadcrumbLd, houseLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const [houses, rooms] = await Promise.all([getHouses(), getRoomsWithBeds()]);
  const home = houses.find((h) => h.slug === slug);
  return { home, houses, rooms: home ? rooms.filter((r) => r.houseId === home.id) : [] };
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
const bedWord = (n: number) => `${n} bed ${n === 1 ? "space" : "spaces"}`;

function RoomRow({ room }: { room: RoomWithBeds }) {
  const features = parseList(room.features);
  const ask = canRequest(room);
  return (
    <li id={`room-${room.slug}`} className="scroll-mt-28 px-5 py-6 sm:px-7">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h3 className="text-[1.2rem] font-semibold tracking-[-0.025em]">{room.name}</h3>
          <p className="mt-0.5 text-[0.92rem] text-ink/65">
            {room.kind === "PRIVATE" ? "Single room, just you" : `Shared room · ${bedWord(room.states.length)}`} · {room.floor === "Ground" ? "Ground floor" : "Upstairs"} · {room.bathroom} bathroom
          </p>
        </div>
        <p className="shrink-0 text-[0.98rem]">
          <span className="mono tabular font-semibold">{money(room.rentCents)}</span>
          <span className="text-ink/60"> /mo{room.kind === "SHARED" ? " per bed" : ""}</span>
        </p>
      </div>
      {room.summary && <p className="mt-3 max-w-2xl text-[0.95rem] text-ink/70">{room.summary}</p>}
      {features.length > 0 && <p className="mt-2 text-[0.88rem] text-moss">{features.join(" · ")}</p>}

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {room.states.map((b) => (
          <li key={b.label} className="flex items-center justify-between gap-3 rounded-xl bg-oat/70 px-4 py-2.5">
            <span className="flex items-center gap-2.5">
              <WindowRow states={[b.state]} size={9} />
              <span className="text-[0.92rem] font-medium">{b.label}</span>
            </span>
            <span className={`text-[0.88rem] ${b.state === "open" ? "font-semibold text-pine" : "text-ink/60"}`}>
              {b.state === "open" ? "Open now" : b.state === "soon" ? `Opens ${longDate(b.availableFrom!)}` : "Taken"}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Link href={ask ? `/apply?room=${room.slug}` : `/waitlist?room=${room.slug}`} className={`btn press !h-11 px-5 ${ask ? "btn-primary" : "btn-ghost"}`}>
          {ask ? (room.kind === "PRIVATE" ? "Request this room" : "Request a bed") : "Join the waitlist"}
        </Link>
        <span className="text-[0.88rem] text-ink/60">{availabilityText(room)}</span>
      </div>
    </li>
  );
}

export default async function HousePage({ params }: { params: Promise<{ slug: string }> }) {
  const [{ home, houses, rooms }, business] = await Promise.all([load((await params).slug), getHouse()]);
  if (!home) notFound();
  const photos = parseList(home.photos);
  const videos = parseList(home.videos);
  const from = rooms.length ? Math.min(...rooms.map((r) => r.rentCents)) : 0;
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
        <Link href="/houses" className="press mb-6 inline-flex items-center gap-2 rounded-full py-2 pr-3 text-[0.92rem] text-ink/65 hover:text-ink">
          <ArrowLeft size={16} /> {houses.length > 1 ? "All houses" : "Back"}
        </Link>

        <h1 className="display text-[clamp(2.6rem,6vw,4.8rem)]">{home.name}</h1>
        <p className="mt-3 flex items-start gap-2 text-ink/65">
          <MapPin size={15} className="mt-[0.3rem] shrink-0" />
          <span>
            {where} · {roomMix(rooms)} · {bedWord(home.beds)}
          </span>
        </p>

        <Reveal variant="clip" className="mt-8">
          <HouseGallery name={home.name} photos={photos} />
        </Reveal>

        <div className="mt-12 grid gap-14 lg:grid-cols-[1fr_380px]">
          <div className="min-w-0 space-y-12">
            {home.summary && <p className="max-w-2xl text-[1.2rem] leading-relaxed text-ink/80">{home.summary}</p>}

            {videos.length > 0 && (
              <section className="border-t border-line pt-10">
                <h2 className="mb-6 text-xl font-semibold tracking-tight">{videos.length === 1 ? "Video tour" : "Video tours"}</h2>
                <div className="grid gap-4">
                  {videos.map((v, i) => (
                    <video key={v} src={v} controls playsInline preload="metadata" aria-label={`${home.name}, video ${i + 1}`} className="aspect-video w-full rounded-[22px] bg-night object-contain" />
                  ))}
                </div>
              </section>
            )}

            <section id="rooms" className="scroll-mt-24 border-t border-line pt-10">
              <div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 className="text-xl font-semibold tracking-tight">Rooms and bed spaces</h2>
                <p className="flex items-center gap-2 text-[0.92rem] text-ink/65">
                  {home.states.length > 0 && <WindowRow states={home.states} size={8} />} {openText(home)}
                </p>
              </div>
              {ordered.length ? (
                <ul className="divide-y divide-line overflow-hidden rounded-[22px] bg-paper ring-1 ring-line">
                  {ordered.map((r) => (
                    <RoomRow key={r.id} room={r} />
                  ))}
                </ul>
              ) : (
                <p className="rounded-[22px] bg-paper px-6 py-8 text-ink/65 ring-1 ring-line">Rooms in this house are being set up. Join the waitlist and we&apos;ll call you when they open.</p>
              )}
              <p className="mt-4 text-[0.88rem] text-ink/60">A single room is yours alone. In a shared room you have your own bed space and share the room with one or more housemates.</p>
            </section>

            <section className="border-t border-line pt-10">
              <h2 className="mb-6 text-xl font-semibold tracking-tight">Every resident shares</h2>
              <p className="max-w-2xl text-ink/70">
                The kitchen, living room and laundry. Rent also covers utilities, Wi‑Fi, rides to appointments and help connecting to services.
              </p>
            </section>

            <section className="border-t border-line pt-10">
              <h2 className="mb-6 text-xl font-semibold tracking-tight">Where it is</h2>
              <p className="flex items-center gap-2 text-ink/80">
                <MapPin size={16} /> {where}
              </p>
              <p className="mt-4 text-[0.95rem] text-ink/70">
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
            <div className="rounded-[28px] bg-paper p-7 shadow-[0_24px_60px_-28px_rgb(23_33_28/.35)] ring-1 ring-line">
              {from > 0 && (
                <p>
                  <span className="text-ink/60">from </span>
                  <span className="display tabular text-4xl">{money(from)}</span>
                  <span className="text-ink/60"> / month</span>
                </p>
              )}
              <p className="mt-1 text-[0.92rem] text-ink/60">{roomMix(rooms)}</p>

              <div className="my-6 flex items-center gap-3 rounded-2xl bg-oat px-4 py-3">
                {home.states.length > 0 && <WindowRow states={home.states} size={10} />}
                <span className="text-[0.95rem] font-semibold">{openText(home)}</span>
              </div>

              <Link href={anyOpen ? "#rooms" : "/waitlist"} className="btn btn-primary press !h-12 w-full">
                {anyOpen ? "Pick a room" : "Join the waitlist"}
              </Link>
              <Link href={`/tour?house=${home.slug}`} className="btn btn-ghost press mt-2.5 !h-12 w-full">
                <CalendarDays size={15} /> Book a tour
              </Link>
              <a href={business.phoneHref} className="press mono mt-2.5 flex h-10 w-full items-center justify-center gap-2 rounded-full text-[0.88rem] text-ink/65 hover:text-ink">
                <Phone size={14} /> {business.phone}
              </a>
              <p className="mt-4 text-center text-[0.85rem] text-ink/60">Requesting is free. We&apos;ll call you before anything is final.</p>
            </div>
          </aside>
        </div>

        {others.length > 0 && (
          <section className="mt-24 border-t border-line pt-14">
            <h2 className="mb-8 text-2xl font-semibold tracking-tight">Other houses</h2>
            <div className="grid gap-x-5 gap-y-10 sm:grid-cols-3">
              {others.slice(0, 3).map((h) => (
                <Link key={h.id} href={`/houses/${h.slug}`} className="group">
                  <div className="aspect-[4/3] overflow-hidden rounded-[20px]">
                    <div className="h-full transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.035]">
                      <HouseImage photos={parseList(h.photos)} alt={h.name} />
                    </div>
                  </div>
                  <p className="mt-3 font-semibold">{h.name}</p>
                  <p className="text-[0.92rem] text-ink/60">
                    {h.town ? `${h.town} · ` : ""}
                    {openText(h)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      {/* phones: the price and the next step stay in reach */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-[640px] items-center justify-between gap-4">
          <div className="min-w-0">
            {from > 0 && (
              <p className="leading-tight">
                <span className="text-[0.85rem] text-ink/60">from </span>
                <span className="tabular font-semibold">{money(from)}</span>
                <span className="text-[0.9rem] text-ink/60"> / mo</span>
              </p>
            )}
            <p className="truncate text-[0.82rem] text-ink/60">{openText(home)}</p>
          </div>
          <Link href={anyOpen ? "#rooms" : "/waitlist"} className="btn btn-primary press !h-12 shrink-0 px-6">
            {anyOpen ? "See rooms" : "Join waitlist"}
          </Link>
        </div>
      </div>
      <SiteFooter />
      <div className="h-20 bg-night lg:hidden" aria-hidden />
    </>
  );
}
