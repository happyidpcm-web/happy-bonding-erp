export interface HsnEntry {
  code: string;
  category: string;
  description: string;
  gstRate: number;
}

export const GARMENT_HSN_CODES: HsnEntry[] = [
  { code: "6205", category: "Men's Shirts", description: "Men's or boys' shirts (Woven cotton, linen, silk, synthetic)", gstRate: 5 },
  { code: "6203", category: "Men's Trousers & Pants", description: "Men's or boys' suits, jackets, trousers, bib & brace overalls, breeches & shorts", gstRate: 5 },
  { code: "6109", category: "T-Shirts & Polo", description: "T-shirts, singlets, tank tops and other vests (Knitted or crocheted)", gstRate: 5 },
  { code: "6107", category: "Men's Underwear & Nightwear", description: "Men's or boys' underpants, briefs, nightshirts, pyjamas, bathrobes", gstRate: 5 },
  { code: "6211", category: "Sportswear & Tracksuits", description: "Track suits, ski suits and swimwear; other garments", gstRate: 5 },
  { code: "6206", category: "Women's Tops & Shirts", description: "Women's or girls' blouses, shirts and shirt-blouses", gstRate: 5 },
  { code: "6204", category: "Women's Suits & Skirts", description: "Women's or girls' suits, ensembles, jackets, dresses, skirts, trousers", gstRate: 5 },
  { code: "6110", category: "Sweaters & Cardigans", description: "Jerseys, pullovers, cardigans, waistcoats and similar articles", gstRate: 5 },
  { code: "6212", category: "Innerwear & Brassieres", description: "Brassieres, girdles, corsets, braces, suspenders, garters", gstRate: 5 },
  { code: "6302", category: "Towels & Bed Linen", description: "Bed linen, table linen, toilet linen and kitchen linen", gstRate: 5 },
  { code: "6115", category: "Socks & Hosiery", description: "Pantyhose, tights, stockings, socks and other hosiery", gstRate: 5 },
  { code: "6505", category: "Caps & Hats", description: "Hats and other headgear, knitted or crocheted", gstRate: 12 },
];
