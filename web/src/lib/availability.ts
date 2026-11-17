import { api } from "./api";
import type { BedView, Property, RoomWithBeds } from "./types";

export type { BedState, BedView, Property, RoomWithBeds } from "./types";

export const getBeds = () => api.get<BedView[]>("/public/beds");
export const getHouses = () => api.get<Property[]>("/public/houses");
export const getRoomsWithBeds = () => api.get<RoomWithBeds[]>("/public/rooms");
