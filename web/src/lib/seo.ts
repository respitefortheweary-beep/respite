import { siteUrl } from "./site";
import type { FaqItem, House } from "./types";

export const SITE_NAME = "Respite for the Weary";

const abs = (path: string) => (/^https?:\/\//.test(path) ? path : `${siteUrl()}${path.startsWith("/") ? "" : "/"}${path}`);

/** "Chester, Virginia" -> "Virginia"; the state comes from the house, so a house in another state is labelled right. */
const regionOf = (town: string) => town.split(",")[1]?.trim() || "";

/** Turns "123 Main St, Chester, Virginia 23831" into the parts search engines want. */
function postalAddress(house: House) {
  const town = house.town.split(",")[0]?.trim();
  const zip = house.address.match(/\b\d{5}\b/)?.[0];
  const i = town ? house.address.toLowerCase().indexOf(town.toLowerCase()) : -1;
  const street = i > 0 ? house.address.slice(0, i).replace(/[,\s]+$/, "") : "";
  return {
    "@type": "PostalAddress",
    ...(street ? { streetAddress: street } : {}),
    ...(town ? { addressLocality: town } : {}),
    ...(regionOf(house.town) ? { addressRegion: regionOf(house.town) } : {}),
    ...(zip ? { postalCode: zip } : {}),
    addressCountry: "US",
  };
}

/** Who we are, for the knowledge panel and local results. */
export function organizationLd(house: House, towns: string[] = []) {
  const url = siteUrl();
  return [
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "@id": `${url}/#organization`,
      name: SITE_NAME,
      description: house.footerBlurb,
      url,
      logo: abs("/icon.svg"),
      image: abs("/images/hero/house-day.webp"),
      telephone: house.phone,
      email: house.email,
      address: postalAddress(house),
      areaServed: [...new Set([...towns, house.town].map((t) => t.trim()).filter(Boolean))].map((name) => ({ "@type": "Place", name })),
      knowsAbout: ["Sober living", "Recovery housing", "Veteran housing", "Housing for veterans using VA benefits", "Senior shared housing", "Independent living for seniors"],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${url}/#website`,
      name: SITE_NAME,
      url,
      publisher: { "@id": `${url}/#organization` },
      inLanguage: "en-US",
    },
  ];
}

export function faqLd(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

export function breadcrumbLd(trail: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t.name, item: abs(t.path) })),
  };
}

/** One listed house and the rooms in it, for search results. */
type RoomForLd = {
  name: string; slug: string; summary: string; kind: string; rentCents: number;
  states: { label: string; state: "open" | "soon" | "taken"; availableFrom: Date | string | null }[];
};

/** A room's bed spaces as offers: rent per bed space a month, and whether one is open now, opening soon or full. */
function roomLd(r: RoomForLd, url: string) {
  const open = r.states.filter((b) => b.state === "open").length;
  const soon = r.states.filter((b) => b.state === "soon" && b.availableFrom).map((b) => new Date(b.availableFrom!).getTime()).sort((a, b) => a - b)[0];
  return {
    "@type": "Room",
    name: r.name,
    url: `${url}#room-${r.slug}`,
    description: r.summary,
    ...(r.kind ? { category: r.kind } : {}),
    occupancy: { "@type": "QuantitativeValue", maxValue: r.states.length, unitText: "bed spaces" },
    bed: { "@type": "BedDetails", numberOfBeds: r.states.length },
    additionalProperty: [
      { "@type": "PropertyValue", name: "Bed spaces", value: r.states.length },
      { "@type": "PropertyValue", name: "Open bed spaces", value: open },
    ],
    ...(r.rentCents
      ? {
          offers: {
            "@type": "Offer",
            name: `Bed space in ${r.name}`,
            url: `${url}#room-${r.slug}`,
            price: (r.rentCents / 100).toFixed(2),
            priceCurrency: "USD",
            priceSpecification: { "@type": "UnitPriceSpecification", price: (r.rentCents / 100).toFixed(2), priceCurrency: "USD", unitText: "MONTH", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" } },
            availability: open ? "https://schema.org/InStock" : soon ? "https://schema.org/PreOrder" : "https://schema.org/SoldOut",
            ...(!open && soon ? { availabilityStarts: new Date(soon).toISOString().slice(0, 10) } : {}),
            inventoryLevel: { "@type": "QuantitativeValue", value: open },
          },
        }
      : {}),
  };
}

export function houseLd(house: { name: string; slug: string; summary: string; town: string; photos: string[] }, rooms: RoomForLd[]) {
  const url = abs(`/houses/${house.slug}`);
  return {
    "@context": "https://schema.org",
    "@type": "Accommodation",
    name: house.name,
    url,
    description: house.summary,
    ...(house.photos.length ? { image: house.photos.map(abs) } : {}),
    ...(house.town ? { address: { "@type": "PostalAddress", addressLocality: house.town.split(",")[0].trim(), ...(regionOf(house.town) ? { addressRegion: regionOf(house.town) } : {}), addressCountry: "US" } } : {}),
    numberOfRooms: rooms.length,
    containsPlace: rooms.map((r) => roomLd(r, url)),
    containedInPlace: { "@id": `${siteUrl()}/#organization` },
  };
}
