import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { getHouse } from "@/lib/content";
import { Logo } from "./brand";
import { HeaderShell } from "./header-shell";
import { MobileMenu } from "./mobile-menu";
import { EqualHousingLogo } from "./equal-housing";
import { PROGRAMS } from "@/lib/programs";

export { Roll, Logo } from "./brand";

const NAV = [
  ["/houses", "Houses"],
  ["/#who", "Who it's for"],
  ["/#included", "Included"],
  ["/#referrals", "Professionals"],
  ["/#faq", "Questions"],
] as const;

export async function SiteHeader() {
  const { phone, phoneHref } = await getHouse();
  return (
    <HeaderShell>
      <div className="mx-auto flex h-[72px] max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-0.5 whitespace-nowrap text-[0.92rem] font-semibold lg:flex" aria-label="Main">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-xl px-3 py-2 text-moss transition-colors hover:bg-oat hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          <a
            href={phoneHref}
            className="press hidden h-10 items-center gap-2 rounded-xl px-3 whitespace-nowrap text-[0.9rem] font-semibold text-ink hover:bg-oat 2xl:inline-flex"
          >
            <Phone size={15} strokeWidth={2.2} className="text-porch" /> {phone}
          </a>
          <a
            href={phoneHref}
            aria-label={`Call ${phone}`}
            className="press hidden h-10 w-10 items-center justify-center rounded-full ring-1 ring-line-strong sm:inline-flex 2xl:hidden"
          >
            <Phone size={16} strokeWidth={2.2} />
          </a>
          <Link href="/tour" className="btn btn-ghost press !h-10 hidden whitespace-nowrap md:inline-flex">
            Book a tour
          </Link>
          <Link href="/apply" className="btn btn-primary press !h-10 whitespace-nowrap">
            Request a room
          </Link>
          <MobileMenu links={[...NAV, ["/tour", "Book a tour"], ["/waitlist", "Waiting list"], ["/apply?for=PROFESSIONAL", "Refer a client"]]} phone={phone} phoneHref={phoneHref} />
        </div>
      </div>
    </HeaderShell>
  );
}

export async function SiteFooter() {
  const house = await getHouse();
  const { phone, phoneHref } = house;
  const cols: [string, [string, string][]][] = [
    ["Houses", [["/houses", "All houses and open beds"], ...PROGRAMS.map((p) => [p.path, p.label] as [string, string])]],
    [
      "Get started",
      [
        ["/apply", "Request a room"],
        ["/tour", "Book a tour"],
        ["/waitlist", "Waiting list"],
        ["/apply?for=PROFESSIONAL", "Refer a client"],
      ],
    ],
    [
      "About",
      [
        ["/#included", "Included"],
        ["/#faq", "Questions"],
        ["/fair-housing", "Fair housing"],
        ["/admin", "Owner login"],
      ],
    ],
  ];
  return (
    <footer className="border-t border-line bg-oat text-ink">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="grid gap-10 py-14 text-[0.95rem] sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            {house.footerBlurb && <p className="mt-4 max-w-sm text-moss">{house.footerBlurb}</p>}
            <div className="mt-5 grid gap-2 font-semibold">
              <a href={phoneHref} className="inline-flex items-center gap-2 hover:text-porch">
                <Phone size={15} className="text-porch" /> {phone}
              </a>
              {house.email && (
                <a href={`mailto:${house.email}`} className="inline-flex items-center gap-2 hover:text-porch">
                  <Mail size={15} className="text-porch" /> {house.email}
                </a>
              )}
            </div>
          </div>
          {cols.map(([title, links]) => (
            <div key={title}>
              <p className="mb-4 font-bold">{title}</p>
              <ul className="space-y-2.5 text-moss">
                {links.map(([href, label]) => (
                  <li key={href}>
                    <Link className="hover:text-ink hover:underline hover:underline-offset-4" href={href}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-line-strong py-6 text-[0.88rem] leading-snug text-moss [--eho-bg:var(--oat)]">
          <EqualHousingLogo className="h-9 w-9 shrink-0 text-ink" />
          <p>
            Equal Housing Opportunity. We follow federal and state fair housing law, and welcome requests for reasonable accommodations.{" "}
            <Link href="/fair-housing" className="font-semibold text-ink underline underline-offset-4 hover:text-porch">Learn more</Link>
          </p>
        </div>
        <div className="flex flex-wrap justify-between gap-3 border-t border-line-strong py-6 text-[0.85rem] text-moss">
          <span>© {new Date().getFullYear()} Respite for the Weary</span>
          <span className="flex gap-5">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/fair-housing" className="hover:text-ink">Fair housing</Link>
          </span>
          {house.footerTagline && <span>{house.footerTagline}</span>}
        </div>
      </div>
    </footer>
  );
}
