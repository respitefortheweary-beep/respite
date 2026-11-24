import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ChevronRight, EyeOff } from "lucide-react";
import { admin } from "@/lib/api";
import type { Property, RoomWithBeds } from "@/lib/types";
import { BedDots } from "@/components/bed-dots";
import { availabilityText } from "@/components/room-card";
import { money } from "@/lib/format";
import { NewRoom } from "../../rooms/new-room";
import { coverHousePhoto, deleteHouse, removeHousePhoto, removeVideo } from "../../../actions";
import { parseList } from "@/lib/format";
import { MediaGrid } from "../../media-grid";
import { Page, Card, CardHead, btnQuiet } from "../../ui";
import { ConfirmAction } from "../../confirm";
import { HouseForm } from "../house-form";

export default async function HouseEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [houses, allRooms, { canUploadPhotos }] = await Promise.all([
    admin.get<Property[]>("/admin/houses"),
    admin.get<RoomWithBeds[]>("/admin/rooms"),
    admin.get<{ canUploadPhotos: boolean }>("/admin/config"),
  ]);
  const house = houses.find((h) => h.id === id);
  if (!house) notFound();
  const rooms = allRooms.filter((r) => r.houseId === house.id);
  const blocked =
    house.rooms > 0
      ? "Move its rooms to another house, or delete them, before deleting the house."
      : houses.length === 1
        ? "This is your only house. Add another before deleting this one."
        : "";

  async function remove() {
    "use server";
    await deleteHouse(id);
  }

  return (
    <Page
      title={house.name}
      crumb={
        <>
          <Link href="/admin/houses" className="hover:text-ink">
            Houses
          </Link>
          <span aria-hidden>/</span>
          <span>House</span>
          {house.hidden && (
            <span className="inline-flex items-center gap-1 text-ink">
              <EyeOff size={12} /> Hidden
            </span>
          )}
        </>
      }
      actions={
        <Link className={btnQuiet} href={`/houses/${house.slug}`} target="_blank">
          View on site <ArrowUpRight size={15} />
        </Link>
      }
    >
      <div className="grid max-w-3xl gap-5">
        <Card>
          <CardHead
            title="About this house"
            hint={`${house.rooms} ${house.rooms === 1 ? "room" : "rooms"} · ${house.beds} ${house.beds === 1 ? "bed" : "beds"} · ${house.open} open`}
          />
          <HouseForm house={{ id: house.id, name: house.name, address: house.address, town: house.town, summary: house.summary, hidden: house.hidden, amenities: parseList(house.amenities) }} />
        </Card>
        <Card>
          <CardHead title="Photos and videos" hint="Everything people see of the house: outside, shared spaces and the rooms. The cover shows first." />
          <MediaGrid
            kind="houses"
            id={house.id}
            photos={parseList(house.photos)}
            videos={parseList(house.videos)}
            canUpload={canUploadPhotos}
            cover={(src) => coverHousePhoto.bind(null, house.id, src)}
            removePhoto={(src) => removeHousePhoto.bind(null, house.id, src)}
            removeVideo={(src) => removeVideo.bind(null, "houses", house.id, src)}
          />
        </Card>
        <Card>
          <CardHead title="Rooms and bed spaces" hint="Open a room to change its rent, its beds, or who is leaving when." />
          {rooms.length ? (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {rooms.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/rooms/${r.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-ink/[.02] sm:px-6">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-medium">
                        <span className="truncate">{r.name}</span>
                        {r.hidden && <EyeOff size={12} className="shrink-0 text-moss" aria-label="Hidden" />}
                      </p>
                      <p className="mt-0.5 text-[0.85rem] text-moss">
                        {r.kind === "PRIVATE" ? "Single room" : `Shared · ${r.states.length} bed spaces`} · <span className="mono tabular">{money(r.rentCents)}</span>
                        {r.kind === "PRIVATE" ? "" : " a bed"} a month
                      </p>
                      <p className="mt-1.5 flex items-center gap-2 text-[0.85rem]">
                        <BedDots states={r.states.map((b) => b.state)} />
                        <span className="truncate">{availabilityText(r).replace(" · join the waitlist", "")}</span>
                      </p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-ink/30 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 pt-4 text-[0.92rem] text-moss sm:px-6">No rooms in this house yet.</p>
          )}
          <div className="p-5 sm:p-6">
            <NewRoom houseId={house.id} houseName={house.name} />
          </div>
        </Card>
        <Card>
          <CardHead title="Delete this house" hint={blocked || "Takes the house off the dashboard and the site for good."} />
          <div className="p-5 pt-4 sm:p-6 sm:pt-4">
            {blocked ? (
              <button disabled className={`${btnQuiet} w-full opacity-50 sm:w-auto`}>
                Delete house
              </button>
            ) : (
              <ConfirmAction
                action={remove}
                label="Delete house"
                className={`${btnQuiet} w-full !text-ember sm:w-auto`}
                title={`Delete ${house.name}?`}
                body="This can't be undone. To take it off the site for a while instead, switch off Show on the site."
                confirmLabel="Delete house"
                danger
              />
            )}
          </div>
        </Card>
      </div>
    </Page>
  );
}
