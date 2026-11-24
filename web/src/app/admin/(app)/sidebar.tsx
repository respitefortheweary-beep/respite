"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Inbox, BedDouble, Users, CreditCard, ArrowUpRight, LogOut, Bell, Globe, UserCog, Wrench, CalendarDays } from "lucide-react";
import type { BedState } from "@/lib/availability";
import { logout } from "../actions";
import { LogoMark } from "@/components/brand";

const ITEMS = [
  { href: "/admin", label: "Overview", short: "Home", icon: Home, exact: true },
  { href: "/admin/requests", label: "Requests", short: "Requests", icon: Inbox, badge: "requests" },
  { href: "/admin/tours", label: "Tours", short: "Tours", icon: CalendarDays, rail: true },
  { href: "/admin/houses", label: "Houses", short: "Houses", icon: BedDouble },
  { href: "/admin/residents", label: "Residents", short: "Residents", icon: Users },
  { href: "/admin/payments", label: "Payments", short: "Payments", icon: CreditCard, badge: "overdue" },
  { href: "/admin/repairs", label: "Repairs", short: "Repairs", icon: Wrench, badge: "repairs", rail: true },
  { href: "/admin/notifications", label: "Notifications", short: "Alerts", icon: Bell, badge: "unread", rail: true },
  { href: "/admin/site", label: "Website", short: "Website", icon: Globe, rail: true },
  { href: "/admin/team", label: "Team", short: "Team", icon: UserCog, rail: true },
] as const;
// the phone tab bar keeps five; the rest sit as icons in the phone's top bar instead
const TABS = ITEMS.filter((it) => !("rail" in it));

function Mark() {
  return <LogoMark className="h-[24px] w-[27px] text-ink" />;
}

/** How full the houses are: a thin bar, teal for free beds. */
function BedBar({ beds, className = "" }: { beds: BedState[]; className?: string }) {
  const n = beds.length || 1;
  const open = beds.filter((b) => b === "open").length;
  const soon = beds.filter((b) => b === "soon").length;
  return (
    <span className={`flex h-1.5 overflow-hidden rounded-full bg-line ${className}`} aria-hidden>
      <span className="bg-porch" style={{ width: `${(open / n) * 100}%` }} />
      <span className="bg-porch/35" style={{ width: `${(soon / n) * 100}%` }} />
    </span>
  );
}

type Me = { name: string; email: string } | null;
type Props = { newRequests: number; overdue: number; beds: BedState[]; unread: number; failedEmails: number; repairs?: number; me?: Me };

const initial = (me: Me) => (me?.name || me?.email || "?").trim().charAt(0).toUpperCase();

/** Who is signed in, as a round initial. */
function Avatar({ me, size = 32 }: { me: Me; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-porch font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.44 }} aria-hidden>
      {initial(me)}
    </span>
  );
}

/** Phone: tap your initial to see who's signed in, open your account, or log out. */
function PhoneAccount({ me }: { me: Me }) {
  return (
    <details className="group relative">
      <summary
        aria-label={me ? `Signed in as ${me.name || me.email}. Account and log out` : "Account and log out"}
        className="press grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full hover:bg-oat [&::-webkit-details-marker]:hidden"
      >
        <Avatar me={me} size={28} />
      </summary>
      <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl bg-paper p-2 text-ink shadow-[0_12px_40px_-12px_rgba(20,24,28,0.25)] ring-1 ring-line">
        {me && (
          <div className="flex items-center gap-3 px-3 py-2.5">
            <Avatar me={me} />
            <div className="min-w-0">
              <p className="text-[0.75rem] text-moss">Signed in as</p>
              <p className="truncate text-[0.93rem] font-medium">{me.name || me.email}</p>
              {me.name && <p className="truncate text-[0.8rem] text-moss">{me.email}</p>}
            </div>
          </div>
        )}
        <div className="mt-1 border-t border-line pt-1">
          <Link href="/admin/team" className="flex h-11 items-center gap-3 rounded-xl px-3 text-[0.93rem] hover:bg-oat">
            <UserCog size={16} className="text-moss" /> Team and your account
          </Link>
          <form action={logout}>
            <button className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[0.93rem] font-medium text-ember hover:bg-ember/[.06]">
              <LogOut size={16} /> Log out
            </button>
          </form>
        </div>
      </div>
    </details>
  );
}

/** The bell: teal when something new came in, ember when an email couldn't be sent. */
function BellLink({ unread, failedEmails, className }: { unread: number; failedEmails: number; className: string }) {
  const n = unread + failedEmails;
  const label = n ? `Notifications, ${unread} unread${failedEmails ? `, ${failedEmails} emails failed` : ""}` : "Notifications";
  return (
    <Link href={failedEmails && !unread ? "/admin/notifications?tab=email" : "/admin/notifications"} aria-label={label} className={className}>
      <span className="relative">
        <Bell size={18} />
        {n > 0 && (
          <span className={`absolute -right-[3px] -top-[2px] h-2 w-2 rounded-full ring-2 ring-white ${failedEmails ? "bg-ember" : "bg-porch"}`} />
        )}
      </span>
    </Link>
  );
}

export function Sidebar({ newRequests, overdue, beds, unread, failedEmails, repairs = 0, me = null }: Props) {
  const path = usePathname();
  const count = { requests: newRequests, overdue, unread: unread + failedEmails, repairs } as const;
  // the waitlist lives under Requests, so it stays lit there too
  const isActive = (href: string, exact?: boolean) =>
    exact
      ? path === href
      : path.startsWith(href) || (href === "/admin/requests" && /^\/admin\/waitlist/.test(path));
  const open = beds.filter((b) => b === "open").length;

  return (
    <>
      {/* Phone: slim top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-white px-4 text-ink md:hidden print:hidden">
        <Link href="/admin" className="flex items-center gap-2" aria-label="Dashboard home">
          <Mark />
          <span className="text-[1.02rem] font-extrabold tracking-[-0.03em]">Respite</span>
        </Link>
        <div className="flex items-center gap-1">
          <span className="mr-2 flex items-center gap-2 text-moss">
            <BedBar beds={beds} className="w-12" />
            <span className="tabular text-[0.75rem] font-semibold">{open}/{beds.length}</span>
          </span>
          <BellLink unread={unread} failedEmails={failedEmails} className="press grid h-10 w-10 place-items-center rounded-full text-moss hover:bg-oat hover:text-ink" />
          <Link href="/admin/site" aria-label="Website" aria-current={isActive("/admin/site") ? "page" : undefined} className={`press grid h-10 w-10 place-items-center rounded-full hover:bg-oat hover:text-ink ${isActive("/admin/site") ? "bg-oat text-porch" : "text-moss"}`}>
            <Globe size={18} />
          </Link>
          <PhoneAccount key={path} me={me} />
        </div>
      </header>

      {/* Desktop: the side rail */}
      <aside className="no-scrollbar sticky top-0 hidden h-dvh flex-col overflow-y-auto border-r border-line bg-white px-3 py-5 text-ink md:flex print:hidden">
        <Link href="/admin" className="flex items-center gap-2.5 px-3">
          <Mark />
          <span className="text-[1.06rem] font-extrabold leading-none tracking-[-0.03em]">
            Respite <span className="font-medium text-moss">for the Weary</span>
          </span>
        </Link>

        <nav className="mt-9" aria-label="Dashboard">
          <ul className="space-y-0.5">
            {ITEMS.map(({ href, label, icon: Icon, ...it }) => {
              const active = isActive(href, "exact" in it && it.exact);
              const n = "badge" in it ? count[it.badge] : 0;
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex h-10 items-center gap-3 rounded-xl px-3 text-[0.93rem] transition-colors duration-150 ${
                      active ? "bg-porch/[.08] font-semibold text-ink" : "text-moss hover:bg-oat hover:text-ink"
                    }`}
                  >
                    <Icon size={17} strokeWidth={1.8} className={active ? "text-porch" : "text-moss/80 group-hover:text-ink"} />
                    <span className="flex-1">{label}</span>
                    {n > 0 && (
                      <span className={`mono tabular grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[0.7rem] font-semibold ${"badge" in it && (it.badge === "overdue" || (it.badge === "unread" && failedEmails)) ? "bg-ember text-white" : "bg-porch text-white"}`}>
                        {n}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="mt-auto pt-6">
          <Link href="/admin/houses" className="block rounded-xl bg-oat px-3 py-3 transition-colors hover:bg-line">
            <span className="flex items-center justify-between text-[0.8rem]">
              <span className="font-semibold text-ink">Beds free</span>
              <span className="tabular text-moss">
                {open} of {beds.length}
              </span>
            </span>
            <BedBar beds={beds} className="mt-2" />
          </Link>
          <div className="mt-2 border-t border-line pt-2 text-[0.9rem]">
            <Link href="/" target="_blank" className="flex h-10 items-center gap-3 rounded-xl px-3 text-moss transition-colors hover:bg-oat hover:text-ink">
              <ArrowUpRight size={17} className="text-moss/80" /> View public site
            </Link>
          </div>
          <div className="mt-2 rounded-2xl p-1 ring-1 ring-line">
            {me && (
              <Link href="/admin/team" className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-oat" title="Team and your account">
                <Avatar me={me} />
                <span className="min-w-0">
                  <span className="block text-[0.72rem] text-moss">Signed in as</span>
                  <span className="block truncate text-[0.88rem] font-semibold text-ink">{me.name || me.email}</span>
                </span>
              </Link>
            )}
            <form action={logout}>
              <button className="mt-1 flex h-10 w-full items-center gap-3 rounded-xl px-2 text-[0.9rem] text-moss transition-colors hover:bg-ember/[.06] hover:text-ember">
                <LogOut size={16} /> Log out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Phone: tab bar within thumb reach */}
      <nav aria-label="Dashboard" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden print:hidden">
        <ul className="grid grid-cols-5">
          {TABS.map(({ href, short, icon: Icon, ...it }) => {
            // repairs and tours have no tab of their own on phones; they live under Residents and Requests
            const active =
              isActive(href, "exact" in it && it.exact) ||
              (href === "/admin/residents" && path.startsWith("/admin/repairs")) ||
              (href === "/admin/requests" && path.startsWith("/admin/tours"));
            const n = "badge" in it ? count[it.badge] : 0;
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={`press relative flex h-[4.25rem] flex-col items-center justify-center gap-1 ${active ? "text-ink" : "text-moss"}`}>
                  <span className="relative">
                    <Icon size={21} strokeWidth={active ? 2.2 : 1.7} />
                    {n > 0 && (
                      <span className={`mono absolute -right-2.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.62rem] font-semibold ${"badge" in it && it.badge === "overdue" ? "bg-ember text-white" : "bg-porch text-white"}`}>
                        {n}
                      </span>
                    )}
                  </span>
                  <span className={`text-[0.68rem] leading-none ${active ? "font-semibold" : ""}`}>{short}</span>
                  {active && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-porch" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
