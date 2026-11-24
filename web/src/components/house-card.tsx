import Link from "next/link";
import type { Property, RoomWithBeds } from "@/lib/availability";
import { money, parseList } from "@/lib/format";
import { HouseImage } from "./room-art";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Beds in shared rooms · Private rooms": the ways you can rent in this house. */
export function roomMix(rooms: Pick<RoomWithBeds, "kind">[]) {
  const priv = rooms.some((r) => r.kind === "PRIVATE");
  const shared = rooms.some((r) => r.kind !== "PRIVATE");
  return [shared && "Beds in shared rooms", priv && "Private rooms"].filter(Boolean).join(" · ") || "Rooms coming soon";
}

export function openText(house: Pick<Property, "open" | "beds">) {
  if (!house.beds) return "Opening soon";
  if (house.open) return `${house.open} of ${plural(house.beds, "bed", "beds")} free`;
  return "Full";
}

/** The grid for a list of houses: up to four across on wide screens, one per row on phones. */
export function houseGrid(_n?: number) {
  return "grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
}

/** Price lines from the rooms themselves: the lowest rent for a bed in a shared room and for a private room. "from" only when prices differ. */
export function priceLines(rooms: Pick<RoomWithBeds, "kind" | "rentCents">[]) {
  const line = (label: string, list: number[]) => {
    const cents = list.filter((c) => c > 0);
    if (!cents.length) return null;
    const low = Math.min(...cents);
    return { label, amount: money(low), from: cents.some((c) => c !== low) };
  };
  return [
    line("Bed", rooms.filter((r) => r.kind !== "PRIVATE").map((r) => r.rentCents)),
    line("Private room", rooms.filter((r) => r.kind === "PRIVATE").map((r) => r.rentCents)),
  ].filter((l): l is NonNullable<typeof l> => !!l);
}

/** One listed house: square photo, how many beds are free, where it is, and what it costs per way to rent. */
export function HouseCard({ house, rooms, priority = false }: { house: Property; rooms: RoomWithBeds[]; priority?: boolean; wide?: boolean }) {
  const photos = parseList(house.photos);
  const prices = priceLines(rooms);
  const full = house.beds > 0 && !house.open;
  return (
    <Link href={`/houses/${house.slug}`} className="group block" prefetch={priority}>
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-oat">
        <div className="h-full w-full transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.03]">
          <HouseImage photos={photos} alt={house.name} />
        </div>
        <span
          className={`absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.8rem] font-bold shadow-sm ${
            full ? "bg-ink text-white" : "bg-white text-ink"
          }`}
        >
          {!full && house.open > 0 && <span className="h-2 w-2 rounded-full bg-porch" aria-hidden />}
          {openText(house)}
        </span>
      </div>
      <div className="mt-3 px-0.5">
        <h3 className="truncate text-[1.05rem] font-bold tracking-[-0.01em] group-hover:underline group-hover:underline-offset-4">{house.name}</h3>
        <p className="mt-0.5 truncate text-[0.9rem] text-moss">
          {[house.town, roomMix(rooms)].filter(Boolean).join(" · ")}
        </p>
        {prices.length > 0 && (
          <ul className="mt-2 grid gap-0.5 text-[0.92rem]">
            {prices.map((p) => (
              <li key={p.label}>
                <span className="text-moss">{p.label} </span>
                {p.from && <span className="text-moss">from </span>}
                <span className="font-bold tabular-nums">{p.amount}</span>
                <span className="text-moss"> / month</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Link>
  );
}
