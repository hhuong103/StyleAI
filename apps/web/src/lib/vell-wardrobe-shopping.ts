import type { ShoppingTarget } from "./vell-shopping";

type Points = [number, number][];
// Coordinates for the 312x512 portrait viewports of the fixed model atlases.
// These editorial hit areas must not be used on arbitrary AI-generated results.
const shortTop: Points = [
  [40, 15],
  [60, 15],
  [72, 20],
  [76, 34],
  [66, 35],
  [65, 47],
  [35, 47],
  [34, 35],
  [24, 34],
  [28, 20],
];
const longTop: Points = [
  [40, 15],
  [60, 15],
  [72, 20],
  [79, 50],
  [70, 51],
  [65, 30],
  [65, 51],
  [35, 51],
  [35, 30],
  [30, 51],
  [21, 50],
  [28, 20],
];
const trousers: Points = [
  [35, 48],
  [65, 48],
  [67, 68],
  [64, 94],
  [53, 94],
  [50, 67],
  [47, 94],
  [36, 94],
  [33, 68],
];
const jacket: Points = [
  [40, 15],
  [46, 18],
  [46, 44],
  [35, 52],
  [35, 30],
  [30, 51],
  [21, 50],
  [28, 20],
  [40, 15],
  [60, 15],
  [72, 20],
  [79, 50],
  [70, 51],
  [65, 30],
  [65, 52],
  [54, 44],
  [54, 18],
];
const inner: Points = [
  [46, 18],
  [54, 18],
  [54, 44],
  [46, 44],
];
const dress: Points = [
  [40, 17],
  [60, 17],
  [64, 24],
  [60, 38],
  [67, 65],
  [70, 83],
  [30, 83],
  [33, 65],
  [40, 38],
  [36, 24],
];

export function wardrobeShopping(): Record<string, ShoppingTarget[]> {
  const result: Record<string, ShoppingTarget[]> = {};
  for (const slug of [
    "alex",
    "minh",
    "marcus",
    "male",
    "linh",
    "amara",
    "sofia",
  ]) {
    const female = ["linh", "amara", "sofia"].includes(slug);
    // Broader silhouettes retain their own hit-area widths, with the hands excluded.
    const scale =
      slug === "amara"
        ? 1.13
        : slug === "linh"
          ? 0.84
          : slug === "minh" || slug === "male"
            ? 0.9
            : 1;
    const target = (
      part: string,
      product: keyof typeof products,
      points: Points,
      marker: [number, number],
    ): ShoppingTarget => ({
      id: `${slug}-${part}`,
      ...products[product],
      match: "SIMILAR",
      polygons: [
        points.map(([x, y]) => [0.5 + (x / 100 - 0.5) * scale, y / 100]),
      ],
      marker: [0.5 + (marker[0] / 100 - 0.5) * scale, marker[1] / 100],
    });
    result[`${slug}-everyday`] = female
      ? [
          target("jeans", "jeans", trousers, [59, 65]),
          target("cardigan", "cardigan", jacket, [65, 28]),
          target("tee", "fTee", inner, [50, 28]),
        ]
      : [
          target("polo", "polo", shortTop, [59, 29]),
          target("chinos", "chinos", trousers, [59, 65]),
        ];
    result[`${slug}-athletic`] = [
      target("sport-top", female ? "fSport" : "mSport", shortTop, [59, 29]),
      target("joggers", female ? "fJoggers" : "mJoggers", trousers, [59, 65]),
    ];
    result[`${slug}-sleep`] = [
      target("sleep-top", female ? "fSleep" : "mSleep", longTop, [59, 29]),
      target(
        "sleep-bottom",
        female ? "fSleep" : "mSleep",
        trousers.map(([x, y]) => [x, Math.max(52, y)]),
        [59, 65],
      ),
    ];
    result[`${slug}-formal`] = [
      target("suit-bottom", female ? "fSuit" : "mSuit", trousers, [59, 68]),
      target("suit-jacket", female ? "fBlazer" : "mBlazer", longTop, [62, 29]),
    ];
    result[`${slug}-party`] = female
      ? [target("dress", "fDress", dress, [56, 45])]
      : [
          target("party-bottom", "mBlack", trousers, [59, 68]),
          target("velvet-jacket", "velvet", longTop, [62, 29]),
        ];
    result[`${slug}-street`] = [
      target("cargo", female ? "fCargo" : "mCargo", trousers, [59, 65]),
      target("bomber", female ? "fBomber" : "mBomber", jacket, [65, 28]),
      target("street-tee", female ? "fTee" : "mTee", inner, [50, 28]),
    ];
  }
  return result;
}

// Official retailer pages researched 2026-11-18; editorial SIMILAR matches.
const products = {
  polo: {
    name: "Áo polo xanh navy nam",
    retailer: "H&M",
    url: "https://www2.hm.com/en_us/productpage.1209183003.html",
    market: "Mỹ",
  },
  chinos: {
    name: "Quần chinos beige nam",
    retailer: "H&M",
    url: "https://www2.hm.com/en_us/productpage.1341415002.html",
    market: "Mỹ",
  },
  mSport: {
    name: "Áo thể thao xám nam",
    retailer: "H&M",
    url: "https://www2.hm.com/en_ie/productpage.1290561002.html",
    market: "Ireland",
  },
  mJoggers: {
    name: "Quần jogger navy nam",
    retailer: "H&M",
    url: "https://www2.hm.com/en_us/productpage.1310655001.html",
    market: "Mỹ",
  },
  mSleep: {
    name: "Bộ pyjama xanh nam",
    retailer: "H&M",
    url: "https://www2.hm.com/en_eur/productpage.1362744002.html",
    market: "Châu Âu",
  },
  mBlazer: {
    name: "Áo suit xám nam",
    retailer: "H&M",
    url: "https://www2.hm.com/en_eur/productpage.1308189001.html",
    market: "Châu Âu",
  },
  mSuit: {
    name: "Quần suit xám nam",
    retailer: "H&M",
    url: "https://www2.hm.com/en_gb/productpage.1262070009.html",
    market: "Anh",
  },
  velvet: {
    name: "Blazer nhung đỏ rượu nam",
    retailer: "H&M",
    url: "https://www2.hm.com/en_gb/productpage.1295803003.html",
    market: "Anh",
  },
  mBlack: {
    name: "Quần âu đen nam",
    retailer: "H&M",
    url: "https://www2.hm.com/en_in/productpage.1262464001.html",
    market: "Ấn Độ",
  },
  mBomber: {
    name: "Bomber nâu nam",
    retailer: "H&M",
    url: "https://www2.hm.com/en_us/productpage.1293696005.html",
    market: "Mỹ",
  },
  mCargo: {
    name: "Quần cargo đen nam",
    retailer: "H&M",
    url: "https://www2.hm.com/en_gb/productpage.1289493001.html",
    market: "Anh",
  },
  mTee: {
    name: "Áo thun trắng nam",
    retailer: "H&M",
    url: "https://www2.hm.com/en_us/productpage.1258851001.html",
    market: "Mỹ",
  },
  cardigan: {
    name: "Cardigan camel nữ",
    retailer: "H&M",
    url: "https://www2.hm.com/en_us/productpage.1239431010.html",
    market: "Mỹ",
  },
  jeans: {
    name: "Quần jeans xanh nữ",
    retailer: "H&M",
    url: "https://www2.hm.com/en_us/productpage.1303107005.html",
    market: "Mỹ",
  },
  fTee: {
    name: "Áo thun trắng nữ",
    retailer: "H&M",
    url: "https://www2.hm.com/en_us/productpage.1264833001.html",
    market: "Mỹ",
  },
  fSport: {
    name: "Áo thể thao xanh ngọc nữ",
    retailer: "H&M",
    url: "https://www2.hm.com/en_us/productpage.1315699005.html",
    market: "Mỹ",
  },
  fJoggers: {
    name: "Quần thể thao đen nữ",
    retailer: "H&M",
    url: "https://www2.hm.com/en_us/productpage.1342177001.html",
    market: "Mỹ",
  },
  fSleep: {
    name: "Bộ pyjama hồng nữ",
    retailer: "H&M",
    url: "https://www2.hm.com/en_gb/productpage.1314587003.html",
    market: "Anh",
  },
  fBlazer: {
    name: "Blazer xám nữ",
    retailer: "H&M",
    url: "https://www2.hm.com/en_gb/productpage.1298693001.html",
    market: "Anh",
  },
  fSuit: {
    name: "Quần âu xám nữ",
    retailer: "H&M",
    url: "https://www2.hm.com/en_in/productpage.1176512012.html",
    market: "Ấn Độ",
  },
  fDress: {
    name: "Đầm midi đỏ rượu nữ",
    retailer: "H&M",
    url: "https://www2.hm.com/en_us/productpage.1368246001.html",
    market: "Mỹ",
  },
  fBomber: {
    name: "Bomber đen nữ",
    retailer: "H&M",
    url: "https://www2.hm.com/en_gb/productpage.1323320001.html",
    market: "Anh",
  },
  fCargo: {
    name: "Quần cargo olive nữ",
    retailer: "H&M",
    url: "https://www2.hm.com/en_in/productpage.1353278001.html",
    market: "Ấn Độ",
  },
} as const;
