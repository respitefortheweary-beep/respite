import { BedDouble, CalendarDays, MapPin, Search, Users } from "lucide-react";
import { PROGRAMS } from "@/lib/labels";

export type SearchValues = { town?: string; from?: string; rent?: string; who?: string };

/** Filters a list of houses by the search bar's answers. Unknown or empty answers keep every house. */
export function matchHouse<H extends { town: string; id: string }>(
  h: H,
  rooms: { houseId: string | null; kind: string; states: { state: string; availableFrom: Date | string | null }[] }[],
  q: SearchValues,
) {
  if (q.town && h.town.trim() !== q.town) return false;
  const mine = rooms.filter((r) => r.houseId === h.id);
  const kinds = q.rent === "bed" ? mine.filter((r) => r.kind !== "PRIVATE") : q.rent === "room" ? mine.filter((r) => r.kind === "PRIVATE") : mine;
  if (q.rent && (q.rent === "bed" || q.rent === "room") && !kinds.length) return false;
  if (q.from) {
    const by = new Date(q.from).getTime();
    if (!Number.isNaN(by)) {
      const free = kinds.some((r) => r.states.some((b) => b.state === "open" || (b.state === "soon" && b.availableFrom && new Date(b.availableFrom).getTime() <= by)));
      if (!free) return false;
    }
  }
  return true;
}

const field = "flex min-w-0 flex-1 items-center gap-3.5 rounded-xl px-4 py-3 transition-colors hover:bg-oat focus-within:bg-oat";
const icon = "shrink-0 text-moss";
const label = "text-[0.8rem] font-bold text-ink";
const input = "w-full min-w-0 truncate bg-transparent text-[0.95rem] text-moss outline-none";

/** The floating search bar: Where, Move in, Rent, Who it's for. It's a plain form that opens /houses with the answers. */
export function HouseSearch({ towns, values = {}, className = "" }: { towns: string[]; values?: SearchValues; className?: string }) {
  const list = [...new Set(towns.map((t) => t.trim()).filter(Boolean))];
  return (
    <form
      action="/houses"
      method="get"
      role="search"
      aria-label="Find a house"
      className={`flex flex-col gap-1 rounded-[18px] bg-white p-2 shadow-[0_12px_40px_-8px_rgba(20,24,28,0.18)] ring-1 ring-line md:flex-row md:items-center ${className}`}
    >
      <label className={field}>
        <MapPin size={21} strokeWidth={1.8} className={icon} aria-hidden />
        <span className="grid min-w-0 flex-1">
        <span className={label}>Where</span>
        <select name="town" defaultValue={values.town ?? ""} className={input}>
          <option value="">Any town, any house</option>
          {list.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        </span>
      </label>
      <span className="mx-1 hidden h-8 w-px bg-line md:block" aria-hidden />
      <label className={field}>
        <CalendarDays size={21} strokeWidth={1.8} className={icon} aria-hidden />
        <span className="grid min-w-0 flex-1">
        <span className={label}>Move in</span>
        <input type="date" name="from" defaultValue={values.from ?? ""} className={input} aria-label="Move-in date" />
        </span>
      </label>
      <span className="mx-1 hidden h-8 w-px bg-line md:block" aria-hidden />
      <label className={field}>
        <BedDouble size={21} strokeWidth={1.8} className={icon} aria-hidden />
        <span className="grid min-w-0 flex-1">
        <span className={label}>Rent</span>
        <select name="rent" defaultValue={values.rent ?? ""} className={input}>
          <option value="">A bed or a room</option>
          <option value="bed">A bed in a shared room</option>
          <option value="room">A private room</option>
        </select>
        </span>
      </label>
      <span className="mx-1 hidden h-8 w-px bg-line md:block" aria-hidden />
      <label className={field}>
        <Users size={21} strokeWidth={1.8} className={icon} aria-hidden />
        <span className="grid min-w-0 flex-1">
        <span className={label}>Who it&apos;s for</span>
        <select name="who" defaultValue={values.who ?? ""} className={input}>
          <option value="">Anyone</option>
          {Object.entries(PROGRAMS).map(([k, p]) => (
            <option key={k} value={k}>{p.long}</option>
          ))}
        </select>
        </span>
      </label>
      <button
        type="submit"
        className="press mt-1 inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-porch px-5 font-bold text-white transition-colors hover:bg-porch-deep md:mt-0 md:mx-1.5 md:h-14 md:w-14 md:px-0"
        aria-label="Search houses"
      >
        <Search size={19} strokeWidth={2.5} />
        <span className="md:hidden">Search</span>
      </button>
    </form>
  );
}
