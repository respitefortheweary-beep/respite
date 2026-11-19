import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Property, RoomWithBeds } from "@/lib/availability";
import { money, parseList } from "@/lib/format";
import { HouseImage } from "./room-art";
import { WindowRow } from "./house";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "2 single rooms · 1 shared room" — what kind of rooms the house has, in a few words. */
export function roomMix(rooms: Pick<RoomWithBeds, "kind">[]) {
  const single = rooms.filter((r) => r.kind === "PRIVATE").length;
  const shared = rooms.length - single;
  return [single && plural(single, "single room", "single rooms"), shared && plural(shared, "shared room", "shared rooms")].filter(Boolean).join(" · ") || "Rooms coming soon";
}

export function openText(house: Pick<Property, "open" | "beds">) {
  if (!house.beds) return "Opening soon";
  if (house.open) return `${house.open} of ${plural(house.beds, "bed space", "bed spaces")} open`;
  return "Full · join the waitlist";
}

/**
 * Columns for a list of houses, so the grid grows with them: one house gets a wide card,
 * two sit side by side, three or more fill a three-column grid. Phones always show one per row.
 */
export function houseGrid(n: number) {
  if (n <= 1) return "grid";
  if (n === 2) return "grid gap-x-5 gap-y-12 sm:grid-cols-2";
  return "grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-3";
}

/** One listed house: its cover, where it is, the rooms in it and how many bed spaces are open. `wide` lays it out across the page when it's the only one. */
export function HouseCard({ house, rooms, priority = false, wide = false }: { house: Property; rooms: RoomWithBeds[]; priority?: boolean; wide?: boolean }) {
  const photos = parseList(house.photos);
  const from = rooms.length ? Math.min(...rooms.map((r) => r.rentCents)) : 0;
  const badge = (
    <span
      className={`mono absolute left-3 top-3 inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[0.74rem] font-medium backdrop-blur ${
        house.open ? "bg-white/95 text-ink" : "bg-ink/75 text-white"
      }`}
    >
      {house.states.length > 0 && <WindowRow states={house.states} size={7} />}
      {openText(house)}
    </span>
  );
  const price = from > 0 && (
    <p className={`shrink-0 leading-tight ${wide ? "md:mt-6 md:text-left md:text-[1.1rem]" : "text-right"} text-[0.95rem]`}>
      <span className="block text-[0.76rem] text-moss">from</span>
      <span className="mono tabular font-medium">{money(from)}</span>
      <span className="text-moss"> /mo</span>
    </p>
  );

  if (wide)
    return (
      <Link href={`/houses/${house.slug}`} className="group grid items-center gap-x-10 gap-y-3.5 md:grid-cols-12" prefetch={priority}>
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-oat md:col-span-7 md:aspect-[16/11]">
          <div className="h-full w-full transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.035]">
            <HouseImage photos={photos} alt={house.name} />
          </div>
          {badge}
        </div>
        <div className="flex items-start justify-between gap-4 px-0.5 md:col-span-5 md:block">
          <div className="min-w-0">
            <h3 className="text-[1.25rem] font-medium tracking-[-0.03em] md:text-[clamp(1.8rem,2.6vw,2.4rem)] md:leading-[1.05]">{house.name}</h3>
            {house.town && <p className="text-[0.92rem] text-ink/70 md:mt-2 md:text-[1.05rem]">{house.town}</p>}
            <p className="mt-0.5 text-[0.88rem] text-moss md:text-[1rem]">{roomMix(rooms)}</p>
            {house.summary && <p className="mt-4 hidden max-w-md text-[0.98rem] leading-relaxed text-ink/70 md:block">{house.summary}</p>}
          </div>
          {price}
          <span className="btn btn-ghost mt-7 hidden md:inline-flex">
            See the rooms <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
    );

  return (
    <Link href={`/houses/${house.slug}`} className="group block" prefetch={priority}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-oat">
        <div className="h-full w-full transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.035]">
          <HouseImage photos={photos} alt={house.name} />
        </div>
        {badge}
      </div>
      <div className="mt-3.5 flex items-start justify-between gap-4 px-0.5">
        <div className="min-w-0">
          <h3 className="truncate text-[1.25rem] font-medium tracking-[-0.03em]">{house.name}</h3>
          {house.town && <p className="text-[0.92rem] text-ink/70">{house.town}</p>}
          <p className="mt-0.5 text-[0.88rem] text-moss">{roomMix(rooms)}</p>
        </div>
        {price}
      </div>
    </Link>
  );
}
