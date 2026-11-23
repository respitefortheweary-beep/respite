import type { Chapter } from "./types";

export type ProgramKey = Chapter["key"];

/**
 * One page per program, written around what people type into Google and Bing
 * ("sober living in <town>", "veteran housing near <town>", "senior shared housing"); the towns come from the listed houses, so a new house in a new town gets its own search words.
 * The owner-edited "Who lives here" chapter fills the body; this is the search-facing frame around it.
 */
export type Program = {
  key: ProgramKey;
  path: string;
  /** the <title>; the site name is added by the layout template */
  title: (town: string) => string;
  description: (town: string) => string;
  /** the visible H1 */
  heading: (town: string) => string;
  intro: (town: string) => string;
  sections: { title: string; body: (town: string) => string }[];
  /** short label for footer and cross links */
  label: string;
};

export const PROGRAMS: Program[] = [
  {
    key: "RECOVERY",
    path: "/sober-living",
    label: "Sober living",
    title: (t) => `Sober living homes in ${t}`,
    description: (t) =>
      `Drug- and alcohol-free sober living homes in ${t}. Furnished rooms, house meetings, rides to meetings and outpatient care. See open beds.`,
    heading: (t) => `Sober living in ${t}`,
    intro: (t) =>
      `Respite for the Weary runs recovery houses in ${t}: furnished, drug- and alcohol-free shared homes for people who have finished or are finishing treatment and want a calm place to keep going.`,
    sections: [
      {
        title: "What a sober house here looks like",
        body: () =>
          "Every house is drug and alcohol free for every resident. There are regular house meetings, clear rules everyone agrees to before moving in, and a house manager you can reach. Rooms come furnished, and rent covers utilities, Wi‑Fi and laundry.",
      },
      {
        title: "Help beyond the room",
        body: () =>
          "We give rides to meetings, outpatient appointments, job interviews and the grocery store, and we connect residents with counselors, IDs, benefits and job training near each house.",
      },
      {
        title: "Referrals welcome",
        body: () =>
          "Treatment centers, recovery courts, probation officers and peer recovery specialists can see open beds live on this site and send a referral in a couple of minutes.",
      },
    ],
  },
  {
    key: "VETERAN",
    path: "/veteran-housing",
    label: "Veteran housing",
    title: (t) => `Veteran housing in ${t}`,
    description: (t) =>
      `Shared, sober homes for veterans in ${t}, with rides to VA appointments. Rent can be paid with VA benefits. See open beds.`,
    heading: (t) => `Housing for veterans in ${t}`,
    intro: (t) =>
      `A furnished room in a calm, structured shared home in ${t}, with people who help with VA appointments, benefits paperwork and rides to the nearest VA medical center.`,
    sections: [
      {
        title: "Rides to the VA",
        body: () =>
          "We drive residents to VA appointments, the pharmacy and benefits offices, and help with the paperwork in between.",
      },
      {
        title: "Paying with VA benefits",
        body: () =>
          "Many residents pay rent with VA benefits, SSI or SSDI. We accept rent from housing vouchers and assistance programs the same as any other payment.",
      },
      {
        title: "For VA social workers and case managers",
        body: () =>
          "HUD-VASH case managers, VA social workers and veteran service officers can see which beds are open tonight and refer a veteran directly from this site.",
      },
    ],
  },
  {
    key: "SENIOR",
    path: "/senior-housing",
    label: "Senior shared housing",
    title: (t) => `Shared housing for independent seniors in ${t}`,
    description: (t) =>
      `Affordable shared homes for independent seniors in ${t}. Your own furnished room, people around, rides to appointments and help arranging home care.`,
    heading: (t) => `Senior shared housing in ${t}`,
    intro: (t) =>
      `For older adults in ${t} who manage their own daily care but would rather not live alone: your own furnished room and routine, in a quiet shared home with help close by.`,
    sections: [
      {
        title: "Not assisted living",
        body: () =>
          "There is no nursing staff on site, so residents need to manage their own daily care. We help arrange home care, appointments and community services when they are needed.",
      },
      {
        title: "What rent covers",
        body: () =>
          "A furnished room, utilities, Wi‑Fi and laundry, use of the kitchen and living areas, and rides to appointments and errands. Ground-floor rooms are available.",
      },
      {
        title: "For families and discharge planners",
        body: () =>
          "Hospital discharge planners, families, churches and the Area Agency on Aging can check open beds live and send a referral from this site.",
      },
    ],
  },
];

export const programFor = (key: ProgramKey) => PROGRAMS.find((p) => p.key === key)!;
