import Link from "next/link";
import { ArrowRight, BedDouble, CircleCheck, DoorClosed, Home as HomeIcon, LayoutGrid, Phone } from "lucide-react";
import { getBeds, getHouses, getRoomsWithBeds } from "@/lib/availability";
import { Faq } from "@/components/faq";
import { HouseCard, houseGrid } from "@/components/house-card";
import { HouseSearch } from "@/components/house-search";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { getContent } from "@/lib/content";
import { programFor } from "@/lib/programs";
import { freshPhoto } from "@/lib/photos";
import { JsonLd } from "@/components/json-ld";
import { faqLd, organizationLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

const WAYS = [
  { href: "/houses", icon: LayoutGrid, title: "Everything", body: "Every house with space" },
  { href: "/houses?rent=bed", icon: BedDouble, title: "A bed in a shared room", body: "Your own bed in a room you share with housemates" },
  { href: "/houses?rent=room", icon: DoorClosed, title: "A private room", body: "A whole room to yourself" },
  { href: "/apply?rent=house", icon: HomeIcon, title: "A whole house", body: "Rent every room in the house" },
];

export default async function HomePage() {
  const [beds, rooms, listed, content] = await Promise.all([getBeds(), getRoomsWithBeds(), getHouses(), getContent()]);
  const { home, who, faq, house } = content;
  const open = beds.filter((b) => b.state === "open").length;
  const houses = listed.length;
  // houses with a free bed come first
  const shown = [...listed].sort((a, b) => Number(b.open > 0) - Number(a.open > 0)).slice(0, 8);
  const live = open
    ? `${open} of ${beds.length} bed ${beds.length === 1 ? "space" : "spaces"} open now${houses > 1 ? ` in ${houses} houses` : ""}`
    : beds.length
      ? "Every bed is taken right now"
      : "Houses opening soon";

  return (
    <>
      <JsonLd data={[...organizationLd(house, listed.map((h) => h.town)), ...(faq.items.length ? [faqLd(faq.items)] : [])]} />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="outline-none">
        {/* ───────── Hero ───────── */}
        <section className="relative overflow-hidden bg-[#edebe6]">
          <img
            src="/images/new/hero.webp"
            alt="A white clapboard house with a deep front porch in late-afternoon light"
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover object-[70%_60%]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.94)_0%,rgba(255,255,255,0.8)_55%,rgba(255,255,255,0.35)_100%)] md:bg-[linear-gradient(90deg,rgba(255,255,255,0.94)_0%,rgba(255,255,255,0.72)_38%,rgba(255,255,255,0)_64%)]" />
          <div className="relative mx-auto max-w-[1240px] px-4 pb-28 pt-14 sm:px-6 md:pb-36 md:pt-24">
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[0.88rem] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
              <span className={`h-2 w-2 rounded-full ${open ? "bg-porch" : "bg-moss"}`} aria-hidden />
              {live}
            </p>
            <h1 className="mt-5 max-w-[640px] text-[clamp(2.4rem,5vw,4rem)] font-extrabold leading-[1.04] tracking-[-0.035em]">
              {home.heroLine1}
              {home.heroLine2 && <> {home.heroLine2}</>}
            </h1>
            <p className="mt-5 max-w-[480px] text-[1.1rem] text-[#3a4046]">{home.heroText}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={open ? "#houses" : "/waitlist"} className="btn btn-primary press !h-[52px] !px-6 !text-[1rem]">
                {open ? "See open beds" : "Join the waiting list"} <ArrowRight size={18} />
              </Link>
              <Link href="/tour" className="btn btn-ghost press !h-[52px] !px-6 !text-[1rem]">
                Book a tour
              </Link>
            </div>
          </div>
        </section>

        {/* ───────── Search ───────── */}
        <div className="relative mx-auto -mt-14 max-w-[1240px] px-4 sm:px-6">
          <HouseSearch towns={listed.map((h) => h.town)} />
        </div>

        {/* ───────── Ways to rent ───────── */}
        <section aria-labelledby="ways" className="mx-auto mt-12 max-w-[1240px] px-4 sm:px-6">
          <h2 id="ways" className="mb-4 text-[1.25rem] font-extrabold tracking-[-0.02em]">Ways to rent</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WAYS.map(({ href, icon: Icon, title, body }) => (
              <Link
                key={title}
                href={href}
                className="press flex items-center gap-4 rounded-2xl bg-white p-5 ring-1 ring-line transition-shadow hover:ring-2 hover:ring-porch"
              >
                <span className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[14px] bg-oat">
                  <Icon size={24} strokeWidth={1.8} />
                </span>
                <span>
                  <span className="block text-[1.05rem] font-bold">{title}</span>
                  <span className="mt-0.5 block text-[0.92rem] text-moss">{body}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ───────── Houses ───────── */}
        <section id="houses" className="mx-auto mt-14 max-w-[1240px] scroll-mt-24 px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[1.75rem] font-extrabold tracking-[-0.025em]">Houses with open beds</h2>
              <p className="mt-1 text-moss">Furnished, with utilities and Wi‑Fi included. Rent is paid monthly.</p>
            </div>
            <Link href="/houses" className="inline-flex items-center gap-2 font-semibold text-porch hover:text-porch-deep">
              {houses > shown.length ? `See all ${houses} houses` : "See all houses"} <ArrowRight size={18} />
            </Link>
          </div>
          {shown.length ? (
            <div className={`mt-6 ${houseGrid(shown.length)}`}>
              {shown.map((h, i) => (
                <HouseCard key={h.id} house={h} rooms={rooms.filter((r) => r.houseId === h.id)} priority={i < 4} />
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-oat p-8 text-moss">New houses are on the way. Join the waiting list and we will tell you when one opens.</p>
          )}
        </section>

        {/* ───────── Who we're for ───────── */}
        <section id="who" className="mx-auto mt-20 max-w-[1240px] scroll-mt-24 px-4 sm:px-6">
          <h2 className="text-[1.75rem] font-extrabold tracking-[-0.025em]">Who we&apos;re for</h2>
          <p className="mt-1 text-moss">Every house is sober. Each program has its own page with the rules and what&apos;s included.</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {who.chapters.map((c) => {
              const p = programFor(c.key);
              const photo = freshPhoto(c.photo.src);
              return (
                <Link key={c.key} href={p.path} className="group block">
                  <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-oat">
                    {photo && <img src={photo} alt={c.photo.alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />}
                  </div>
                  <h3 className="mt-4 text-[1.15rem] font-bold">{c.word}</h3>
                  <p className="mt-1 text-[0.95rem] text-moss">{c.line}</p>
                  <span className="mt-2.5 inline-flex items-center gap-1.5 text-[0.95rem] font-semibold text-porch group-hover:text-porch-deep">
                    Learn more <ArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ───────── What's included ───────── */}
        <section id="included" className="mx-auto mt-20 max-w-[1240px] scroll-mt-24 px-4 sm:px-6">
          <div className="rounded-[20px] bg-oat px-6 py-9 sm:px-8">
            <h2 className="text-[1.5rem] font-extrabold tracking-[-0.02em]">{home.includedTitle}</h2>
            {home.includedText && <p className="mt-1 max-w-2xl text-moss">{home.includedText}</p>}
            <div className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {home.included.map(({ label, title, body }, i) => (
                <div key={`${i}-${title}`} className="flex gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-porch ring-1 ring-line">
                    <CircleCheck size={20} strokeWidth={2} />
                  </span>
                  <div>
                    {label && <p className="text-[0.8rem] font-semibold text-porch">{label}</p>}
                    <h3 className="font-bold">{title}</h3>
                    <p className="mt-1 text-[0.92rem] text-moss">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── Waiting list ───────── */}
        <section className="mx-auto mt-10 max-w-[1240px] px-4 sm:px-6">
          <div className="flex flex-wrap items-stretch overflow-hidden rounded-[20px] ring-1 ring-line">
            <div className="min-h-[200px] flex-[1_1_320px] bg-oat">
              <img src="/images/new/waitlist-banner.webp" alt="" loading="lazy" className="h-full w-full object-cover" />
            </div>
            <form action="/waitlist" method="get" className="flex flex-[999_1_420px] flex-wrap items-center gap-6 px-6 py-8 sm:px-10">
              <div className="flex-[1_1_260px]">
                <h2 className="text-[1.5rem] font-extrabold tracking-[-0.02em]">Can&apos;t find a free bed?</h2>
                <p className="mt-1.5 text-moss">Leave your email. We will tell you as soon as a bed is free.</p>
              </div>
              <div className="flex flex-[1_1_340px] flex-wrap gap-2.5">
                <label htmlFor="wl-email" className="sr-only">Email address</label>
                <input
                  id="wl-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="Your email address"
                  className="h-[50px] min-w-0 flex-[1_1_200px] rounded-xl border border-line-strong px-4 text-[0.95rem] outline-none focus:border-porch"
                />
                <button type="submit" className="btn btn-primary press !h-[50px]">
                  Tell me when a bed is free
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* ───────── For professionals ───────── */}
        <section id="referrals" className="mx-auto mt-20 max-w-[1240px] scroll-mt-24 px-4 sm:px-6">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <p className="eyebrow">Case managers and discharge planners</p>
              <h2 className="mt-2 text-[1.75rem] font-extrabold tracking-[-0.025em]">
                {home.referralsLine1}
                {home.referralsLine2 && <> {home.referralsLine2}</>}
              </h2>
              <p className="mt-3 max-w-lg text-moss">{home.referralsText}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/apply?for=PROFESSIONAL" className="btn btn-primary press">
                  Refer a client <ArrowRight size={16} />
                </Link>
                <a href={house.phoneHref} className="btn btn-ghost press">
                  <Phone size={15} /> {house.phone}
                </a>
              </div>
            </div>
            {home.photos.referral?.src && (
              <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-oat">
                <img src={freshPhoto(home.photos.referral.src)} alt={home.photos.referral.alt} loading="lazy" className="h-full w-full object-cover" />
              </div>
            )}
          </div>
        </section>

        {/* ───────── FAQ ───────── */}
        {faq.items.length > 0 && (
          <section id="faq" className="mx-auto mt-20 grid max-w-[1240px] scroll-mt-24 gap-8 px-4 sm:px-6 md:grid-cols-[1fr_2fr]">
            <div>
              <h2 className="text-[1.75rem] font-extrabold tracking-[-0.025em]">Questions</h2>
              <p className="mt-1 text-moss">
                Something else? Call <a href={house.phoneHref} className="font-semibold text-ink underline underline-offset-4">{house.phone}</a>.
              </p>
            </div>
            <Faq items={faq.items.map((f) => [f.q, f.a] as [string, string])} />
          </section>
        )}

        {/* ───────── Closing ───────── */}
        <section className="mx-auto mb-20 mt-20 max-w-[1240px] px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-[20px] bg-ink px-6 py-10 text-white sm:px-10">
            <div className="max-w-xl">
              <h2 className="text-[1.6rem] font-extrabold tracking-[-0.02em]">
                {home.closingLine1}
                {home.closingLine2 && <> {home.closingLine2}</>}
              </h2>
              {home.closingText && <p className="mt-2 text-white/70">{home.closingText}</p>}
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={open ? "/apply" : "/waitlist"} className="btn btn-primary press">
                {open ? "Request a room" : "Join the waiting list"} <ArrowRight size={16} />
              </Link>
              <Link href="/tour" className="btn press bg-white text-ink hover:bg-oat">
                Book a tour
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
