import { siteUrl } from "./site";
import type { FaqItem, House } from "./types";

export const SITE_NAME = "Respite for the Weary";

const abs = (path: string) => (/^https?:\/\//.test(path) ? path : `${siteUrl()}${path.startsWith("/") ? "" : "/"}${path}`);

/** Turns "123 Main St, Chester, Virginia 23831" into the parts search engines want. */
function postalAddress(house: House) {
  const town = house.town.split(",")[0]?.trim() || "Chester";
  const zip = house.address.match(/\b\d{5}\b/)?.[0];
  const i = house.address.toLowerCase().indexOf(town.toLowerCase());
  const street = i > 0 ? house.address.slice(0, i).replace(/[,\s]+$/, "") : "";
  return {
    "@type": "PostalAddress",
    ...(street ? { streetAddress: street } : {}),
    addressLocality: town,
    addressRegion: "VA",
    ...(zip ? { postalCode: zip } : {}),
    addressCountry: "US",
  };
}

/** Who we are, for the knowledge panel and local results. */
export function organizationLd(house: House) {
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
      areaServed: { "@type": "City", name: house.town },
      knowsAbout: ["Sober living", "Veteran housing", "Recovery housing", "Senior shared housing"],
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

export function roomLd(room: { name: string; slug: string; summary: string; kind: string; bathroom: string; photos: string[]; features: string[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "Room",
    name: room.name,
    url: abs(`/rooms/${room.slug}`),
    description: room.summary,
    ...(room.photos.length ? { image: room.photos.map(abs) } : {}),
    amenityFeature: room.features.map((f) => ({ "@type": "LocationFeatureSpecification", name: f, value: true })),
    containedInPlace: { "@id": `${siteUrl()}/#organization` },
  };
}
