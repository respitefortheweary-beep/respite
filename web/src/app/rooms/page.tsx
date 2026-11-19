import { permanentRedirect } from "next/navigation";

/** The site lists houses now; old room links and search results land on the houses list (or the one house asked for). */
export default async function RoomsMoved({ searchParams }: { searchParams: Promise<{ house?: string }> }) {
  const { house } = await searchParams;
  permanentRedirect(house ? `/houses/${encodeURIComponent(house)}` : "/houses");
}
