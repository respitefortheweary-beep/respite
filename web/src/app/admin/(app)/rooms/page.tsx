import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronRight, EyeOff, Pencil } from "lucide-react";
import { admin } from "@/lib/api";
import type { Property, RoomWithBeds } from "@/lib/types";
import { money, parseList } from "@/lib/format";
import { RoomImage } from "@/components/room-art";
import { WindowRow } from "@/components/house";
import { availabilityText } from "@/components/room-card";
import { moveHouse, moveRoom } from "../../actions";
import { Notice, Page, btnQuiet } from "../ui";
import { NewRoom } from "./new-room";
import { NewHouse } from "../houses/house-form";

const arrow =
  "press grid w-10 flex-1 place-items-center rounded-xl bg-paper text-ink ring-1 ring-line transition-colors hover:bg-ink/[.04] disabled:pointer-events-none disabled:opacity-35";

function Arrows({ name, at, count, move }: { name: string; at: number; count: number; move: (by: -1 | 1) => () => Promise<void> }) {
  return (
    <div className="flex flex-col gap-1">
      {([[-1, ArrowUp, "up"], [1, ArrowDown, "down"]] as const).map(([by, Icon, word]) => (
        <form key={word} action={move(by)} className="flex flex-1">
          <button disabled={by === -1 ? at === 0 : at === count - 1} aria-label={`Move ${name} ${word}`} className={arrow}>
            <Icon size={15} />
          </button>
        </form>
      ))}
    </div>
  );
}

function Hidden() {
  return (
    <span className="mono inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-ink/[.06] px-2 text-[0.66rem] font-medium uppercase text-moss">
      <EyeOff size={11} /> Hidden
    </span>
  );
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function RoomsAdmin({ searchParams }: { searchParams: Promise<{ deleted?: string; house?: string }> }) {
  const [rooms, houses, { deleted, house: houseNote }] = await Promise.all([
    admin.get<RoomWithBeds[]>("/admin/rooms"),
    admin.get<Property[]>("/admin/houses"),
    searchParams,
  ]);
  const beds = rooms.reduce((n, r) => n + r.states.length, 0);
  const open = rooms.reduce((n, r) => n + r.states.filter((s) => s.state === "open").length, 0);
  const houseIds = houses.map((h) => h.id);
  const several = houses.length > 1;
  // a room with no house (only possible mid-migration) is listed under the first one, as the API treats it
  const roomsOf = (h: Property, i: number) => rooms.filter((r) => r.houseId === h.id || (i === 0 && !houseIds.includes(r.houseId ?? "")));
  // the API takes every room's id in order; a room only ever swaps with a neighbour in its own house
  const grouped = houses.map(roomsOf);
  const allIds = grouped.flat().map((r) => r.id);

  return (
    <Page title="Rooms" eyebrow={`${several ? `${houses.length} houses · ` : ""}${rooms.length} rooms · ${beds} beds · ${open} open`}>
      {deleted && <Notice>Room deleted. It no longer shows on the site.</Notice>}
      {houseNote === "added" && <Notice>House added. Add its rooms below. Each house numbers its own beds from Bed 1.</Notice>}
      {houseNote === "deleted" && <Notice>House deleted.</Notice>}
      <div className="mb-8">
        <NewHouse />
      </div>

      <div className="grid gap-12">
        {houses.map((h, hi) => {
          const list = grouped[hi];
          const start = grouped.slice(0, hi).reduce((n, g) => n + g.length, 0);
          return (
            <section key={h.id} id={`house-${h.id}`} aria-labelledby={`house-${h.id}-name`} className="scroll-mt-24">
              <header className="mb-4 flex items-start gap-3 border-b border-line pb-4">
                <div className="min-w-0 flex-1">
                  <h2 id={`house-${h.id}-name`} className="flex flex-wrap items-center gap-2 text-[1.35rem] font-semibold tracking-[-0.03em]">
                    <span className="min-w-0 truncate">{h.name}</span>
                    {h.hidden && <Hidden />}
                  </h2>
                  <p className="mt-0.5 text-[0.88rem] text-moss">
                    {h.address || h.town || "No address yet"}
                    <span className="mono tabular">
                      {" "}
                      · {count(h.rooms, "room", "rooms")} · {count(h.beds, "bed", "beds")} · {h.open} open
                    </span>
                  </p>
                </div>
                <Link href={`/admin/houses/${h.id}`} className={`${btnQuiet} shrink-0`}>
                  <Pencil size={14} /> <span className="hidden sm:inline">Edit house</span>
                  <span className="sr-only sm:hidden">Edit {h.name}</span>
                </Link>
                {several && <Arrows name={h.name} at={hi} count={houses.length} move={(by) => moveHouse.bind(null, houseIds, hi, by)} />}
              </header>

              {list.length ? (
                <ul className="grid gap-4 sm:grid-cols-2">
                  {list.map((r, i) => {
                    const photos = parseList(r.photos);
                    return (
                      <li key={r.id} className="flex items-stretch gap-2">
                        <Link
                          href={`/admin/rooms/${r.id}`}
                          className="group flex min-w-0 flex-1 items-center gap-4 rounded-2xl bg-paper p-3 ring-1 ring-line transition-[box-shadow] duration-200 hover:ring-line-strong"
                        >
                          <div className="h-24 w-28 shrink-0 overflow-hidden rounded-xl sm:w-32">
                            <RoomImage photos={photos} tone={r.tone} alt="" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 font-semibold tracking-[-0.02em]">
                              <span className="truncate">{r.name}</span>
                              {r.hidden && <Hidden />}
                            </p>
                            <p className="mt-0.5 truncate text-[0.85rem] text-moss">
                              {r.kind === "PRIVATE" ? "Private" : "Shared"} · <span className="mono tabular">{money(r.rentCents)}</span> a month
                            </p>
                            <p className="mt-2.5 flex items-center gap-2 text-[0.85rem]">
                              <WindowRow states={r.states.map((s) => s.state)} size={8} />{" "}
                              <span className="truncate">{availabilityText(r).replace(" · join the waitlist", "")}</span>
                            </p>
                            {!photos.length && <p className="mono mt-1.5 text-[0.7rem] uppercase text-ember">Needs photos</p>}
                          </div>
                          <ChevronRight size={18} className="shrink-0 text-ink/30 transition-transform duration-200 group-hover:translate-x-0.5" />
                        </Link>
                        {list.length > 1 && <Arrows name={r.name} at={i} count={list.length} move={(by) => moveRoom.bind(null, allIds, start + i, by)} />}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-2xl border border-dashed border-line-strong px-5 py-6 text-[0.92rem] text-moss">No rooms in this house yet.</p>
              )}
              <div className="mt-4">
                <NewRoom houseId={h.id} houseName={several ? h.name : undefined} />
              </div>
            </section>
          );
        })}
      </div>
      <p className="mt-10 max-w-xl text-[0.88rem] leading-relaxed text-moss">
        Changes show on the public site right away, in this order. A bed opens by itself when its resident moves out.
      </p>
    </Page>
  );
}
