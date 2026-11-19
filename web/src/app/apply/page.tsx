import type { Metadata } from "next";
import { getRoomsWithBeds } from "@/lib/availability";
import { getHouse } from "@/lib/content";
import { getWhere } from "@/lib/where";
import { Flow } from "./flow";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Request a room",
    description: `Ask for a bed in a sober, shared home in ${await getWhere()}. A short form for yourself or someone you refer; we call within one business day.`,
    alternates: { canonical: "/apply" },
  };
}
export const dynamic = "force-dynamic";

export default async function ApplyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [rooms, house] = await Promise.all([getRoomsWithBeds(), getHouse()]);
  return (
    <Flow
      rooms={rooms.map((r) => ({
        slug: r.slug,
        name: r.name,
        house: r.house?.name,
        kind: r.kind,
        floor: r.floor,
        rentCents: r.rentCents,
        tone: r.tone,
        states: r.states.map((s) => s.state),
        open: r.open,
        soon: r.soon ? r.soon.toISOString() : null,
      }))}
      initialRoom={sp.room}
      initialFor={sp.for === "PROFESSIONAL" ? "PROFESSIONAL" : undefined}
      phone={{ label: house.phone, href: house.phoneHref }}
    />
  );
}
