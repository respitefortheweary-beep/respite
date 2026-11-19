import { redirect } from "next/navigation";

/** Rooms live inside their house now; old links and bookmarks land on the houses list. */
export default async function RoomsMoved({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const q = new URLSearchParams(await searchParams).toString();
  redirect(`/admin/houses${q ? `?${q}` : ""}`);
}
