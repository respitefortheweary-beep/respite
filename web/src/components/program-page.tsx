import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { getHouses, getRoomsWithBeds } from "@/lib/availability";
import { getContent } from "@/lib/content";
import { getWhere } from "@/lib/where";
import { PROGRAMS, programFor, type ProgramKey } from "@/lib/programs";
import { breadcrumbLd, SITE_NAME } from "@/lib/seo";
import { siteUrl } from "@/lib/site";
import { SiteHeader, SiteFooter } from "./site-chrome";
import { HouseCard, houseGrid } from "./house-card";
import { Reveal } from "./reveal";
import { JsonLd } from "./json-ld";

export async function programMetadata(key: ProgramKey): Promise<Metadata> {
  const p = programFor(key);
  const town = await getWhere();
  const title = p.title(town);
  const description = p.description(town);
  return {
    title,
    description,
    alternates: { canonical: p.path },
    openGraph: { title: `${title} · ${SITE_NAME}`, description, url: p.path },
  };
}

/** A search-facing page for one program: keyword heading, the owners' own words for it, live houses, and a way in. */
export async function ProgramPage({ program: key }: { program: ProgramKey }) {
  const p = programFor(key);
  const [content, houses, rooms, town] = await Promise.all([getContent(), getHouses(), getRoomsWithBeds(), getWhere()]);
  const chapter = content.who.chapters.find((c) => c.key === key);
  const open = houses.reduce((n, h) => n + h.open, 0);
  const towns = [...new Set(houses.map((h) => h.town.trim()).filter(Boolean))];
  if (!towns.length) towns.push(town);
  const others = PROGRAMS.filter((o) => o.key !== key);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: p.label, path: p.path },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "Service",
            name: p.heading(town),
            description: p.description(town),
            serviceType: p.label,
            url: `${siteUrl()}${p.path}`,
            provider: { "@id": `${siteUrl()}/#organization` },
            areaServed: towns.map((name) => ({ "@type": "Place", name })),
          },
        ]}
      />
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1240px] px-4 pb-28 sm:px-6">
        <div className="grid gap-10 pb-14 pt-12 sm:pt-16 md:grid-cols-[1.1fr_1fr] md:items-center md:gap-16">
          <div>
            <p className="eyebrow">{chapter?.word ?? p.label}</p>
            <h1 className="display mt-3 text-[clamp(2.4rem,5vw,4rem)]" style={{ textWrap: "balance" }}>
              {p.heading(town)}
            </h1>
            <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-ink/70" style={{ textWrap: "pretty" }}>
              {p.intro(town)}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/apply" className="btn btn-primary press">
                Request a room
              </Link>
              <Link href="/tour" className="btn btn-ghost press">
                Book a tour
              </Link>
            </div>
            <p className="mt-5 text-[0.95rem] text-ink/60">
              <span className="font-semibold text-ink">
                {open} bed {open === 1 ? "space" : "spaces"} open
              </span>{" "}
              · {houses.length} {houses.length === 1 ? "house" : "houses"} in {town}
            </p>
          </div>
          {chapter?.photo.src && (
            <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-oat">
              <img src={chapter.photo.src} alt={chapter.photo.alt || ""} className="h-full w-full object-cover" />
            </div>
          )}
        </div>

        {chapter && (
          <section className="rounded-2xl bg-oat p-7 sm:p-10">
            <h2 className="text-[1.6rem] font-medium leading-[1.15] tracking-[-0.035em]">
              {chapter.word} {chapter.line}
            </h2>
            <p className="mt-4 max-w-3xl text-moss">{chapter.body}</p>
            {chapter.good.length > 0 && (
              <ul className="mt-6 grid gap-2 text-[0.95rem] sm:grid-cols-3">
                {chapter.good.map((g) => (
                  <li key={g} className="flex gap-3">
                    <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-porch" />
                    {g}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <div className="mt-16 grid gap-10 md:grid-cols-3">
          {p.sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em]">{s.title}</h2>
              <p className="mt-3 leading-relaxed text-ink/75" style={{ textWrap: "pretty" }}>
                {s.body(town)}
              </p>
            </section>
          ))}
        </div>

        {houses.length > 0 && (
          <section className="mt-20">
            <h2 className="display text-[clamp(1.8rem,3.6vw,2.6rem)]">Houses in {town}</h2>
            <div className={`mt-8 ${houseGrid(houses.length)}`}>
              {houses.map((h, i) => (
                <Reveal key={h.id} delay={(i % 3) * 60}>
                  <HouseCard house={h} rooms={rooms.filter((r) => r.houseId === h.id)} wide={houses.length === 1} />
                </Reveal>
              ))}
            </div>
          </section>
        )}

        <p className="mt-16 max-w-3xl text-[0.9rem] leading-relaxed text-ink/60">
          We describe our houses as homes for {(chapter?.word ?? p.label).toLowerCase()} because that is the support we are set up to give. Anyone can ask about a
          room. See our{" "}
          <Link href="/fair-housing" className="underline underline-offset-4">
            fair housing policy
          </Link>
          .
        </p>

        <nav aria-label="Other programs" className="mt-10 flex flex-wrap gap-x-8 gap-y-3 border-t border-line pt-8">
          {others.map((o) => (
            <Link key={o.path} href={o.path} className="group inline-flex items-center gap-2 font-medium text-ink">
              {o.label} in {town}
              <ArrowRight size={17} className="transition-transform duration-200 ease-[var(--ease-out)] group-hover:translate-x-1" />
            </Link>
          ))}
        </nav>
      </main>
      <SiteFooter />
    </>
  );
}
