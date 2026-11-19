import type { RoomWithBeds } from "@/lib/availability";
import { shortDate } from "@/lib/format";

export function availabilityText(room: Pick<RoomWithBeds, "open" | "soon" | "states">) {
  if (room.open > 0) return room.states.length > 1 ? `${room.open} of ${room.states.length} beds open` : "Open now";
  if (room.soon) return `Opens ${shortDate(room.soon)}`;
  return "Full · join the waitlist";
}
