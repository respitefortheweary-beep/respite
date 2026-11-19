import { permanentRedirect } from "next/navigation";
import { getRoomsWithBeds } from "@/lib/availability";

export const dynamic = "force-dynamic";

/** A room is part of its house's page now: send old room links to that house, scrolled to the room. */
export default async function RoomMoved({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const room = (await getRoomsWithBeds().catch(() => [])).find((r) => r.slug === slug);
  permanentRedirect(room?.house ? `/houses/${room.house.slug}#room-${room.slug}` : "/houses");
}
