import { wardrobeShopping } from "./vell-wardrobe-shopping";

export type ShoppingTarget = {
  id: string;
  name: string;
  retailer: string;
  url: string;
  match: "SIMILAR" | "VERIFIED";
  market?: string;
  validUntil?: string;
  polygons: [number, number][][];
  marker: [number, number];
};

// Editorial suggestions, NOT exact garment identities or verified catalog entries.
// Official product pages researched 2026-11-18. See docs/runbooks/vell-shopping.md.
const products = {
  tank: [
    "Áo sát nách đen",
    "UNIQLO",
    "https://www.uniqlo.com/us/en/products/E449182-000/00",
    "Mỹ",
  ],
  skirt: [
    "Chân váy denim",
    "H&M",
    "https://www2.hm.com/en_gb/productpage.1322244001.html",
    "Anh",
  ],
  ivoryShirt: [
    "Sơ mi satin kem",
    "H&M",
    "https://www2.hm.com/en_gb/productpage.1280837003.html",
    "Anh",
  ],
  ivoryPants: [
    "Quần ống rộng kem",
    "H&M",
    "https://www2.hm.com/en_ie/productpage.1264853007.html",
    "Ireland",
  ],
  whiteLong: [
    "Áo trắng dài tay",
    "H&M",
    "https://www2.hm.com/en_us/productpage.1267021001.html",
    "Mỹ",
  ],
  greyPants: [
    "Quần ống rộng xám",
    "H&M",
    "https://www2.hm.com/en_in/productpage.1176512012.html",
    "Ấn Độ",
  ],
  purpleBlazer: [
    "Blazer tím nhạt",
    "H&M",
    "https://www2.hm.com/en_ie/productpage.1147937003.html",
    "Ireland",
  ],
  purplePants: [
    "Quần âu tím nhạt",
    "H&M",
    "https://www2.hm.com/en_in/productpage.1325060001.html",
    "Ấn Độ",
  ],
  pajamas: [
    "Bộ pyjama satin xanh",
    "H&M",
    "https://www2.hm.com/en_in/productpage.1260335007.html",
    "Ấn Độ",
  ],
  blackBlazer: [
    "Blazer đen",
    "H&M",
    "https://www2.hm.com/en_us/productpage.1209691001.html",
    "Mỹ",
  ],
  blackPants: [
    "Quần âu đen",
    "H&M",
    "https://www2.hm.com/en_gb/productpage.1357547003.html",
    "Anh",
  ],
  dress: [
    "Đầm satin xanh",
    "H&M",
    "https://www2.hm.com/en_us/productpage.1329907001.html",
    "Mỹ",
  ],
  bomber: [
    "Áo khoác bomber đen",
    "H&M",
    "https://www2.hm.com/en_gb/productpage.1323320001.html",
    "Anh",
  ],
  cargo: [
    "Quần cargo xanh olive",
    "H&M",
    "https://www2.hm.com/en_in/productpage.1353278001.html",
    "Ấn Độ",
  ],
  tee: [
    "Áo thun trắng dáng ngắn",
    "H&M",
    "https://www2.hm.com/en_ie/productpage.1201712002.html",
    "Ireland",
  ],
} as const;

type Points = [number, number][];
const region = (
  id: string,
  product: keyof typeof products,
  polygon: Points,
  marker: [number, number],
): ShoppingTarget => {
  const [name, retailer, url, market] = products[product];
  return {
    id,
    name,
    retailer,
    url,
    market,
    match: "SIMILAR",
    polygons: [polygon.map(([x, y]) => [x / 100, y / 100])],
    marker: [marker[0] / 100, marker[1] / 100],
  };
};
const pants: Points = [
  [38, 40],
  [61, 40],
  [66, 72],
  [63, 93],
  [53, 94],
  [50, 64],
  [47, 94],
  [35, 93],
  [33, 72],
];
const shirt: Points = [
  [43, 18],
  [56, 18],
  [64, 22],
  [70, 47],
  [63, 49],
  [60, 30],
  [61, 51],
  [37, 51],
  [38, 30],
  [33, 49],
  [27, 47],
  [34, 22],
];
const blazer: Points = [
  [44, 18],
  [38, 20],
  [33, 23],
  [29, 49],
  [34, 50],
  [39, 31],
  [38, 49],
  [47, 45],
  [47, 22],
  [54, 22],
  [54, 45],
  [62, 49],
  [61, 31],
  [66, 50],
  [71, 49],
  [66, 23],
  [57, 18],
  [54, 21],
  [47, 21],
];
const inner: Points = [
  [47, 20],
  [54, 20],
  [54, 37],
  [46, 37],
];

// Hand-authored hit areas tied only to these fixed illustrative image assets.
// They are never reused as segmentation for generated try-on results/model presets.
export const illustrativeShopping: Record<string, ShoppingTarget[]> = {
  ...wardrobeShopping(),
  denim: [
    region(
      "denim-top",
      "tank",
      [
        [43, 18],
        [57, 18],
        [58, 23],
        [61, 26],
        [59, 36],
        [41, 36],
        [39, 26],
        [42, 23],
      ],
      [56, 27],
    ),
    region(
      "denim-skirt",
      "skirt",
      [
        [40, 38],
        [60, 38],
        [72, 83],
        [62, 85],
        [36, 85],
        [27, 83],
      ],
      [58, 56],
    ),
  ],
  cream: [
    region("cream-top", "ivoryShirt", shirt, [58, 30]),
    region(
      "cream-bottom",
      "ivoryPants",
      [
        [37, 53],
        [61, 53],
        [64, 78],
        [62, 94],
        [52, 95],
        [50, 68],
        [47, 95],
        [36, 94],
        [34, 78],
      ],
      [58, 65],
    ),
  ],
  grey: [
    region(
      "grey-top",
      "whiteLong",
      [
        [43, 18],
        [57, 18],
        [65, 22],
        [69, 49],
        [64, 49],
        [59, 29],
        [60, 40],
        [40, 40],
        [40, 29],
        [35, 49],
        [31, 49],
        [35, 22],
      ],
      [56, 29],
    ),
    region("grey-bottom", "greyPants", pants, [58, 60]),
  ],
  lavender: [
    region("lavender-bottom", "purplePants", pants, [58, 62]),
    region(
      "lavender-jacket",
      "purpleBlazer",
      blazer.map(([x, y]) => [x, y > 35 && x > 36 && x < 64 ? y - 10 : y]),
      [62, 28],
    ),
    region("lavender-inner", "tee", inner, [50, 30]),
  ],
  blue: [
    region("blue-shirt", "pajamas", shirt, [58, 30]),
    region(
      "blue-pants",
      "pajamas",
      [
        [37, 51],
        [61, 51],
        [65, 81],
        [63, 94],
        [53, 95],
        [50, 68],
        [47, 95],
        [35, 94],
        [34, 81],
      ],
      [58, 65],
    ),
  ],
  formal: [
    region("formal-bottom", "blackPants", pants, [58, 65]),
    region("formal-jacket", "blackBlazer", blazer, [62, 28]),
    region("formal-inner", "tee", inner, [50, 30]),
  ],
  sage: [
    region(
      "sage-dress",
      "dress",
      [
        [40, 21],
        [43, 24],
        [55, 25],
        [60, 21],
        [59, 34],
        [63, 50],
        [65, 81],
        [58, 84],
        [36, 82],
        [38, 50],
        [41, 34],
      ],
      [56, 43],
    ),
  ],
  street: [
    region("street-bottom", "cargo", pants, [58, 63]),
    region(
      "street-jacket",
      "bomber",
      [
        [45, 17],
        [34, 20],
        [29, 27],
        [26, 42],
        [30, 51],
        [35, 51],
        [37, 43],
        [44, 46],
        [47, 21],
        [54, 21],
        [56, 46],
        [63, 46],
        [65, 51],
        [70, 51],
        [73, 42],
        [69, 27],
        [64, 21],
        [56, 17],
        [54, 20],
        [47, 20],
      ],
      [63, 29],
    ),
    region("street-inner", "tee", inner, [50, 30]),
  ],
};

export function safeShoppingUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
