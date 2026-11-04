import type { StaticImageData } from "next/image";
import goldTiger from "@/assets/hero/gold-tiger.jpg";
import snowLeopard from "@/assets/hero/snow-leopard.jpg";
import whiteTiger from "@/assets/hero/white-tiger.jpg";

export type HeroItem = "earrings" | "necklace" | "bracelet" | "ring" | "pendant" | "chain";

export type HeroPanel = {
  key: "silver" | "diamond" | "gold";
  image: StaticImageData;
  /** Keeps the animal's head in frame in every crop (desktop third, phone screen). */
  position: string;
  /** Unsplash photographer, shown in the credit line. */
  credit: string;
  /** Catalog query for this metal, merged with the item's category. */
  filter: Record<string, string>;
  /** Jewelry the model wears, each linking to the filtered catalog. */
  items: { item: HeroItem; category: string }[];
};

/**
 * Left to right: white tiger (silver), snow leopard (diamond), tiger (gold).
 * Photos: Unsplash License, cropped to 1440x2400 portrait (docs/credits.md).
 * Each animal later turns into a model wearing that metal (owner's photo shoot).
 */
export const HERO_PANELS: HeroPanel[] = [
  {
    key: "silver",
    image: whiteTiger,
    position: "42% 40%",
    credit: "Tommaso Ubezio",
    filter: { metal: "SILVER" },
    items: [
      { item: "earrings", category: "sirgalar" },
      { item: "necklace", category: "boyunbagilar" },
      { item: "bracelet", category: "qolbaqlar" },
      { item: "ring", category: "uzukler" },
    ],
  },
  {
    key: "diamond",
    image: snowLeopard,
    position: "50% 35%",
    credit: "Wildlife by Irina",
    filter: { minCarat: "0.01" },
    items: [
      { item: "earrings", category: "sirgalar" },
      { item: "pendant", category: "asqilar" },
      { item: "ring", category: "uzukler" },
    ],
  },
  {
    key: "gold",
    image: goldTiger,
    position: "58% 35%",
    credit: "Lambert Huang",
    filter: { metal: "GOLD" },
    items: [
      { item: "earrings", category: "sirgalar" },
      { item: "chain", category: "zencirler" },
      { item: "bracelet", category: "qolbaqlar" },
    ],
  },
];

export function itemHref(panel: HeroPanel, category: string) {
  return { pathname: "/products" as const, query: { ...panel.filter, category } };
}
