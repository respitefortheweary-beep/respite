import {
  Accessibility, AirVent, AlarmSmoke, BadgeCheck, Ban, BedDouble, BriefcaseMedical, Bus, Car, Cctv, CigaretteOff,
  CookingPot, DoorOpen, FireExtinguisher, HandHeart, Heater, Laptop, Lock, Microwave, Moon, PawPrint, Refrigerator,
  ShieldAlert, ShowerHead, Sofa, SquareParking, Trees, Tv, Users, WashingMachine, Wifi, Zap, type LucideIcon,
} from "lucide-react";

/** Everything a house can offer. Owners tick these per house; the house page lists the ticked ones. */
export type Amenity = { key: string; label: string; icon: LucideIcon };
export type AmenityGroup = { title: string; items: Amenity[] };

export const AMENITY_GROUPS: AmenityGroup[] = [
  {
    title: "The house",
    items: [
      { key: "wifi", label: "Wi-Fi", icon: Wifi },
      { key: "furnished", label: "Furnished bedrooms", icon: BedDouble },
      { key: "kitchen", label: "Shared kitchen", icon: CookingPot },
      { key: "fridge", label: "Fridge space for each resident", icon: Refrigerator },
      { key: "microwave", label: "Microwave", icon: Microwave },
      { key: "living-room", label: "Shared living room", icon: Sofa },
      { key: "tv", label: "TV", icon: Tv },
      { key: "laundry", label: "Washer and dryer", icon: WashingMachine },
      { key: "utilities", label: "Utilities included", icon: Zap },
      { key: "ac", label: "Air conditioning", icon: AirVent },
      { key: "heating", label: "Heating", icon: Heater },
      { key: "workspace", label: "Desk or quiet place to work", icon: Laptop },
      { key: "yard", label: "Yard or porch", icon: Trees },
      { key: "parking", label: "Free parking", icon: SquareParking },
    ],
  },
  {
    title: "Support and transport",
    items: [
      { key: "rides", label: "Rides to appointments", icon: Car },
      { key: "bus", label: "Near a bus line", icon: Bus },
      { key: "services", label: "Help connecting to services", icon: HandHeart },
      { key: "va", label: "VA benefits accepted", icon: BadgeCheck },
      { key: "meetings", label: "Close to recovery meetings", icon: Users },
    ],
  },
  {
    title: "Accessibility",
    items: [
      { key: "step-free", label: "Step-free entrance", icon: Accessibility },
      { key: "ground-floor", label: "Ground-floor bedrooms", icon: DoorOpen },
      { key: "grab-bars", label: "Grab bars in the bathroom", icon: ShowerHead },
    ],
  },
  {
    title: "Safety",
    items: [
      { key: "smoke-alarm", label: "Smoke alarms", icon: AlarmSmoke },
      { key: "co-alarm", label: "Carbon monoxide alarm", icon: ShieldAlert },
      { key: "extinguisher", label: "Fire extinguisher", icon: FireExtinguisher },
      { key: "first-aid", label: "First aid kit", icon: BriefcaseMedical },
      { key: "locks", label: "Lockable bedroom doors", icon: Lock },
      { key: "cameras", label: "Cameras outside the house", icon: Cctv },
    ],
  },
  {
    title: "House rules",
    items: [
      { key: "sober", label: "Sober house, no alcohol or drugs", icon: Ban },
      { key: "no-smoking", label: "No smoking inside", icon: CigaretteOff },
      { key: "quiet-hours", label: "Quiet hours at night", icon: Moon },
      { key: "pets", label: "Pets allowed", icon: PawPrint },
    ],
  },
];

const BY_KEY = new Map(AMENITY_GROUPS.flatMap((g) => g.items.map((a) => [a.key, a] as const)));

/** The house's ticked amenities in catalogue order, grouped; unknown keys are dropped. */
export function houseAmenities(keys: string[]): AmenityGroup[] {
  const have = new Set(keys);
  return AMENITY_GROUPS.map((g) => ({ ...g, items: g.items.filter((a) => have.has(a.key)) })).filter((g) => g.items.length);
}

export const amenityCount = (keys: string[]) => keys.filter((k) => BY_KEY.has(k)).length;
