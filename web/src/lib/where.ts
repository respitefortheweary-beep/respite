import { cache } from "react";
import { getHouses } from "./availability";
import { getHouse } from "./content";
import { townsText } from "./format";

/** Where the houses are, in words, from the houses themselves; the business town until any house has one. */
export const getWhere = cache(async () => {
  const [houses, business] = await Promise.all([getHouses().catch(() => []), getHouse()]);
  return townsText(houses.map((h) => h.town), business.town);
});
