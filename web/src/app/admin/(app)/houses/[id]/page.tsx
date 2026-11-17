import Link from "next/link";
import { notFound } from "next/navigation";
import { EyeOff } from "lucide-react";
import { admin } from "@/lib/api";
import type { Property } from "@/lib/types";
import { deleteHouse } from "../../../actions";
import { Page, Card, CardHead, btnQuiet } from "../../ui";
import { ConfirmAction } from "../../confirm";
import { HouseForm } from "../house-form";

export default async function HouseEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const houses = await admin.get<Property[]>("/admin/houses");
  const house = houses.find((h) => h.id === id);
  if (!house) notFound();
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
          <Link href="/admin/rooms" className="hover:text-ink">
            Rooms
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
        <Link className={btnQuiet} href={`/admin/rooms#house-${house.id}`}>
          Its rooms
        </Link>
      }
    >
      <div className="grid max-w-3xl gap-5">
        <Card>
          <CardHead
            title="About this house"
            hint={`${house.rooms} ${house.rooms === 1 ? "room" : "rooms"} · ${house.beds} ${house.beds === 1 ? "bed" : "beds"} · ${house.open} open`}
          />
          <HouseForm house={{ id: house.id, name: house.name, address: house.address, town: house.town, summary: house.summary, hidden: house.hidden }} />
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
