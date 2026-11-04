export type LookProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  sizes: string[];
  price: number;
  hotspot: { x: number; y: number };
  purchaseUrl?: string;
  thumbnail?: string;
  thumbnailPosition?: string;
};

export type FeaturedLook = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  image: string;
  /** Optional separate cutout (transparent background) image.
   *  Falls back to image.replace(".png", "-cutout.png") when omitted. */
  cutout?: string;
  /** Set to false for looks that don't have a local -poses.png contact sheet. */
  hasPoses?: boolean;
  alt: string;
  accent: string;
  products: LookProduct[];
};

export const featuredLooks: FeaturedLook[] = [
  {
    id: "coral-weekend",
    eyebrow: "01 / WEEKEND EDIT",
    title: "Coral confidence",
    subtitle: "Polished separates with a playful point of view.",
    image: "/images/shop-the-look/coral-weekend.png",
    alt: "Model wearing an ivory blouse, red skirt and white sneakers",
    accent: "#ef7774",
    products: [
      {
        id: "ivory-blouse",
        name: "Sculpted cuff blouse",
        category: "BLOUSE",
        description:
          "A fluid ivory blouse with a sharp collar and softly sculpted cuffs.",
        sizes: ["XS", "S", "M", "L"],
        price: 579000,
        hotspot: { x: 52, y: 33 },
        thumbnail: "/media/demo/photos/shirt-white.webp",
      },
      {
        id: "red-skirt",
        name: "Cherry A-line skirt",
        category: "SKIRT",
        description:
          "A high-waisted mini skirt with clean panel lines and a confident silhouette.",
        sizes: ["XS", "S", "M", "L", "XL"],
        price: 649000,
        hotspot: { x: 53, y: 52 },
        thumbnailPosition: "center 50%",
      },
      {
        id: "white-sneakers",
        name: "Everyday leather sneakers",
        category: "SNEAKERS",
        description:
          "Clean low-profile sneakers designed to keep tailored looks effortless.",
        sizes: ["36", "37", "38", "39", "40"],
        price: 829000,
        hotspot: { x: 52, y: 88 },
        thumbnail: "/media/demo/photos/sneakers.webp",
      },
    ],
  },
  {
    id: "soft-tailoring",
    eyebrow: "02 / WORKDAY EDIT",
    title: "Soft tailoring",
    subtitle: "Warm neutrals, precise lines, quiet confidence.",
    image: "/images/shop-the-look/soft-tailoring.png",
    alt: "Model wearing a sand blazer, ivory knit, cream trousers and brown loafers",
    accent: "#e8c477",
    products: [
      {
        id: "sand-blazer",
        name: "Relaxed sand blazer",
        category: "BLAZER",
        description:
          "An easy single-breasted blazer with softened shoulders and a long line.",
        sizes: ["XS", "S", "M", "L"],
        price: 1199000,
        hotspot: { x: 35, y: 34 },
        thumbnailPosition: "center 28%",
      },
      {
        id: "ivory-knit",
        name: "Fine rib knit",
        category: "T_SHIRT",
        description:
          "A close-fitting ivory knit that layers cleanly beneath tailoring.",
        sizes: ["XS", "S", "M", "L", "XL"],
        price: 459000,
        hotspot: { x: 51, y: 35 },
        thumbnail: "/media/demo/photos/white-tee.webp",
      },
      {
        id: "cream-trousers",
        name: "Straight cream trousers",
        category: "TROUSERS",
        description:
          "Mid-rise straight-leg trousers finished with a clean pressed crease.",
        sizes: ["26", "28", "30", "32"],
        price: 779000,
        hotspot: { x: 51, y: 63 },
        thumbnailPosition: "center 66%",
      },
      {
        id: "brown-loafers",
        name: "Polished penny loafers",
        category: "LOAFERS",
        description:
          "Rich brown leather loafers with a low stacked heel for all-day wear.",
        sizes: ["36", "37", "38", "39", "40"],
        price: 899000,
        hotspot: { x: 49, y: 89 },
        thumbnail: "/media/demo/photos/loafers-brown.webp",
      },
    ],
  },
  {
    id: "modern-utility",
    eyebrow: "03 / UTILITY EDIT",
    title: "Modern utility",
    subtitle: "Relaxed proportions built for movement.",
    image: "/images/shop-the-look/modern-utility.png",
    alt: "Model wearing a green overshirt, white tee, charcoal cargo trousers and sneakers",
    accent: "#9eae91",
    products: [
      {
        id: "green-overshirt",
        name: "Forest utility overshirt",
        category: "LIGHT_JACKET",
        description:
          "A substantial cotton overshirt with relaxed shoulders and patch pockets.",
        sizes: ["S", "M", "L", "XL"],
        price: 849000,
        hotspot: { x: 35, y: 34 },
        thumbnailPosition: "center 30%",
      },
      {
        id: "heavy-tee",
        name: "Heavyweight white tee",
        category: "T_SHIRT",
        description:
          "A structured crew-neck T-shirt cut with a clean, slightly relaxed shape.",
        sizes: ["S", "M", "L", "XL"],
        price: 349000,
        hotspot: { x: 50, y: 38 },
        thumbnail: "/media/demo/photos/white-tee.webp",
      },
      {
        id: "charcoal-cargo",
        name: "Wide charcoal cargos",
        category: "CARGO",
        description:
          "Wide-leg cargo trousers with functional pockets and a softly washed finish.",
        sizes: ["28", "30", "32", "34"],
        price: 749000,
        hotspot: { x: 53, y: 65 },
        thumbnailPosition: "center 66%",
      },
      {
        id: "retro-sneakers",
        name: "Cream retro sneakers",
        category: "SNEAKERS",
        description:
          "Low-profile cream sneakers with a softly contrasted sole.",
        sizes: ["39", "40", "41", "42", "43"],
        price: 899000,
        hotspot: { x: 50, y: 89 },
        thumbnail: "/media/demo/photos/sneakers.webp",
      },
    ],
  },
  {
    id: "after-dark",
    eyebrow: "04 / EVENING EDIT",
    title: "After dark",
    subtitle: "Satin, structure and an understated shine.",
    image: "/images/shop-the-look/after-dark.png",
    alt: "Model wearing a navy satin dress, cropped black jacket and silver sandals",
    accent: "#ad92a4",
    products: [
      {
        id: "cropped-jacket",
        name: "Cropped black blazer",
        category: "BLAZER",
        description:
          "A sharp cropped jacket that frames evening silhouettes without hiding them.",
        sizes: ["XS", "S", "M", "L"],
        price: 999000,
        hotspot: { x: 58, y: 31 },
        thumbnailPosition: "center 27%",
      },
      {
        id: "navy-dress",
        name: "Midnight satin dress",
        category: "DRESS",
        description:
          "A fluid midi dress with a softly draped neckline and luminous satin finish.",
        sizes: ["XS", "S", "M", "L"],
        price: 1299000,
        hotspot: { x: 53, y: 54 },
        thumbnailPosition: "center 52%",
      },
      {
        id: "silver-sandals",
        name: "Silver block-heel sandals",
        category: "SANDALS",
        description:
          "Minimal silver sandals with a comfortable low block heel.",
        sizes: ["36", "37", "38", "39", "40"],
        price: 699000,
        hotspot: { x: 49, y: 89 },
        thumbnailPosition: "center 88%",
      },
    ],
  },
  {
    id: "city-denim",
    eyebrow: "05 / STREET EDIT",
    title: "City denim",
    subtitle: "Double denim, sharpened for the new season.",
    image: "/images/shop-the-look/city-denim-cutout.png",
    cutout: "/images/shop-the-look/city-denim-cutout.png",
    hasPoses: false,
    alt: "Model wearing a cropped denim jacket, white tank, dark wide-leg jeans and silver sneakers",
    accent: "#7895b4",
    products: [
      {
        id: "cropped-denim-jacket",
        name: "Cropped denim jacket",
        category: "DENIM_JACKET",
        description:
          "An oversized cropped jacket in softly washed blue denim with structured volume.",
        sizes: ["XS", "S", "M", "L"],
        price: 899000,
        hotspot: { x: 50, y: 30 },
      },
      {
        id: "clean-white-tank",
        name: "Clean white tank",
        category: "TANK_TOP",
        description:
          "A fitted ribbed tank with a clean neckline, made for effortless layering.",
        sizes: ["XS", "S", "M", "L", "XL"],
        price: 289000,
        hotspot: { x: 50, y: 35 },
      },
      {
        id: "indigo-wide-jeans",
        name: "Indigo wide-leg jeans",
        category: "JEANS",
        description:
          "High-waisted dark indigo jeans with an exaggerated wide leg and contrast stitching.",
        sizes: ["26", "28", "30", "32"],
        price: 849000,
        hotspot: { x: 50, y: 67 },
      },
      {
        id: "silver-court-sneakers",
        name: "Silver court sneakers",
        category: "SNEAKERS",
        description:
          "Low-profile metallic sneakers that add a polished flash to relaxed denim.",
        sizes: ["36", "37", "38", "39", "40"],
        price: 929000,
        hotspot: { x: 50, y: 92 },
      },
    ],
  },
  {
    id: "neo-prep",
    eyebrow: "06 / CAMPUS EDIT",
    title: "Neo prep",
    subtitle: "Heritage layers with a relaxed modern rhythm.",
    image: "/images/shop-the-look/neo-prep-cutout.png",
    cutout: "/images/shop-the-look/neo-prep-cutout.png",
    hasPoses: false,
    alt: "Model wearing a burgundy cardigan, blue Oxford shirt, charcoal trousers and black loafers",
    accent: "#8f4c56",
    products: [
      {
        id: "burgundy-cardigan",
        name: "Varsity knit cardigan",
        category: "CARDIGAN",
        description:
          "A deep burgundy cardigan with collegiate stripes and a generous contemporary fit.",
        sizes: ["S", "M", "L", "XL"],
        price: 799000,
        hotspot: { x: 50, y: 34 },
      },
      {
        id: "blue-oxford-shirt",
        name: "Pale blue Oxford shirt",
        category: "SHIRT",
        description:
          "A crisp cotton Oxford shirt cut long enough to layer beneath relaxed knitwear.",
        sizes: ["S", "M", "L", "XL"],
        price: 559000,
        hotspot: { x: 50, y: 41 },
      },
      {
        id: "charcoal-pleated-trousers",
        name: "Charcoal pleated trousers",
        category: "TROUSERS",
        description:
          "Relaxed charcoal trousers with deep front pleats and an easy draped line.",
        sizes: ["28", "30", "32", "34"],
        price: 799000,
        hotspot: { x: 50, y: 67 },
      },
      {
        id: "chunky-black-loafers",
        name: "Chunky black loafers",
        category: "LOAFERS",
        description:
          "High-shine leather loafers grounded by a confident lugged sole.",
        sizes: ["39", "40", "41", "42", "43"],
        price: 999000,
        hotspot: { x: 50, y: 92 },
      },
    ],
  },
  {
    id: "elevated-active",
    eyebrow: "07 / ACTIVE EDIT",
    title: "Electric motion",
    subtitle: "Technical energy, balanced by a sleek black base.",
    image: "/images/shop-the-look/elevated-active-cutout.png",
    cutout: "/images/shop-the-look/elevated-active-cutout.png",
    hasPoses: false,
    alt: "Model wearing a chartreuse track jacket, black performance top, flared leggings and white running shoes",
    accent: "#b7d62c",
    products: [
      {
        id: "chartreuse-track-jacket",
        name: "Chartreuse track jacket",
        category: "SPORT_JACKET",
        description:
          "A cropped technical shell in vivid chartreuse with an adjustable gathered hem.",
        sizes: ["XS", "S", "M", "L"],
        price: 879000,
        hotspot: { x: 50, y: 29 },
      },
      {
        id: "black-performance-top",
        name: "Black performance top",
        category: "SPORT_TOP",
        description:
          "A smooth fitted performance top designed as a clean base for bright layers.",
        sizes: ["XS", "S", "M", "L", "XL"],
        price: 399000,
        hotspot: { x: 50, y: 38 },
      },
      {
        id: "flared-leggings",
        name: "Studio flared leggings",
        category: "LEGGINGS",
        description:
          "High-rise matte leggings with a subtle flare and a long, fluid silhouette.",
        sizes: ["XS", "S", "M", "L"],
        price: 629000,
        hotspot: { x: 50, y: 69 },
      },
      {
        id: "sculptural-runners",
        name: "Sculptural white runners",
        category: "RUNNING_SHOES",
        description:
          "Cushioned white runners with a dimensional sole for an elevated sport finish.",
        sizes: ["36", "37", "38", "39", "40"],
        price: 1099000,
        hotspot: { x: 50, y: 92 },
      },
    ],
  },
  {
    id: "monochrome-edge",
    eyebrow: "08 / MONO EDIT",
    title: "Monochrome edge",
    subtitle: "Texture and proportion bring black into focus.",
    image: "/images/shop-the-look/monochrome-edge-cutout.png",
    cutout: "/images/shop-the-look/monochrome-edge-cutout.png",
    hasPoses: false,
    alt: "Model wearing a black bomber, gray knit, wide black trousers and ankle boots",
    accent: "#737475",
    products: [
      {
        id: "black-leather-bomber",
        name: "Cropped leather bomber",
        category: "BOMBER",
        description:
          "A matte faux-leather bomber with clean ribbed trims and a sharp cropped length.",
        sizes: ["S", "M", "L", "XL"],
        price: 1299000,
        hotspot: { x: 50, y: 32 },
      },
      {
        id: "gray-fine-knit",
        name: "Heather-gray fine knit",
        category: "KNITWEAR",
        description:
          "A refined crewneck knit that adds soft contrast beneath dark outerwear.",
        sizes: ["S", "M", "L", "XL"],
        price: 649000,
        hotspot: { x: 50, y: 37 },
      },
      {
        id: "black-volume-trousers",
        name: "Black volume trousers",
        category: "TROUSERS",
        description:
          "Wide tailored trousers with sculptural pleats and a softly tapered hem.",
        sizes: ["28", "30", "32", "34"],
        price: 879000,
        hotspot: { x: 50, y: 68 },
      },
      {
        id: "sleek-ankle-boots",
        name: "Sleek ankle boots",
        category: "BOOTS",
        description:
          "Minimal black ankle boots with a refined toe and low stacked heel.",
        sizes: ["39", "40", "41", "42", "43"],
        price: 1199000,
        hotspot: { x: 50, y: 92 },
      },
    ],
  },
];

export function findRunwayProduct(lookId: string, productId: string) {
  const look = featuredLooks.find((entry) => entry.id === lookId);
  const product = look?.products.find((entry) => entry.id === productId);
  return look && product ? { look, product } : null;
}

export const shopeeQueries: Record<string, string> = {
  "ivory-blouse": "áo sơ mi nữ trắng kem tay cách điệu",
  "red-skirt": "chân váy chữ A đỏ mini",
  "white-sneakers": "giày sneaker trắng nữ",
  "sand-blazer": "áo blazer nữ màu be form rộng",
  "ivory-knit": "áo len tăm nữ trắng kem",
  "cream-trousers": "quần tây nữ ống suông trắng kem",
  "brown-loafers": "giày loafer da nâu nữ",
  "green-overshirt": "áo khoác sơ mi nam xanh rêu",
  "heavy-tee": "áo thun nam trắng cotton form rộng",
  "charcoal-cargo": "quần cargo nam ống rộng xám đậm",
  "retro-sneakers": "giày sneaker nam retro màu kem",
  "cropped-jacket": "áo blazer nữ croptop đen",
  "navy-dress": "đầm satin cổ đổ xanh navy midi",
  "silver-sandals": "sandal nữ bạc gót vuông thấp",
  "cropped-denim-jacket": "áo khoác denim nữ dáng lửng form rộng",
  "clean-white-tank": "áo tank top nữ trắng ôm dáng",
  "indigo-wide-jeans": "quần jean nữ xanh đậm ống rộng",
  "silver-court-sneakers": "giày sneaker nữ bạc dáng thấp",
  "burgundy-cardigan": "áo cardigan nam đỏ burgundy varsity",
  "blue-oxford-shirt": "áo sơ mi Oxford nam xanh nhạt",
  "charcoal-pleated-trousers": "quần tây nam xám than xếp ly ống rộng",
  "chunky-black-loafers": "giày loafer nam đen đế chunky",
  "chartreuse-track-jacket": "áo khoác thể thao nữ xanh neon dáng lửng",
  "black-performance-top": "áo thể thao nữ đen ôm dáng",
  "flared-leggings": "quần legging nữ ống loe màu đen",
  "sculptural-runners": "giày chạy bộ nữ trắng đế dày",
  "black-leather-bomber": "áo bomber da đen nam dáng lửng",
  "gray-fine-knit": "áo len nam xám cổ tròn mỏng",
  "black-volume-trousers": "quần tây nam đen ống rộng xếp ly",
  "sleek-ankle-boots": "giày boots nam cổ thấp màu đen",
};

export function shopeeUrl(product: LookProduct, size?: string | null) {
  if (product.purchaseUrl) return product.purchaseUrl;
  const query = [
    shopeeQueries[product.id] || product.name,
    size ? `size ${size}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return `https://shopee.vn/search?keyword=${encodeURIComponent(query)}`;
}

export function runwayProductUrl(look: FeaturedLook, product: LookProduct) {
  return `/outfits/${look.id}/${product.id}`;
}

// Garment silhouettes in the original 2:3 image, expressed as percentages.
// Separate polygons let sleeves and paired shoes share one accessible link.
export const garmentAreas: Record<string, string[]> = {
  "ivory-blouse": [
    "40,17 55,17 64,22 70,26 73,32 66,37 61,29 60,35 40,35 38,40 34,48 27,45 29,35 33,24",
  ],
  "red-skirt": ["40,34 60,34 66,42 76,54 48,58 33,55 37,43"],
  "white-sneakers": [
    "25,87 34,87 34,94 22,95 22,92",
    "54,87 64,88 68,94 65,96 53,94",
  ],
  "sand-blazer": [
    "35,20 47,19 48,26 43,40 43,54 31,53 30,43 32,27",
    "55,21 62,20 68,25 73,43 67,53 58,51 56,38 57,28",
  ],
  "ivory-knit": ["48,19 55,20 57,30 56,39 46,40 46,30"],
  "cream-trousers": ["44,40 57,40 59,53 60,88 52,89 49,59 44,89 33,90 36,55"],
  "brown-loafers": [
    "32,88 43,88 43,94 28,96 27,94",
    "52,89 60,88 63,93 63,96 53,95",
  ],
  "green-overshirt": [
    "34,18 47,18 48,23 44,36 43,49 31,49 30,40 32,24",
    "56,19 63,19 70,24 74,44 70,50 58,49 57,35 56,25",
  ],
  "heavy-tee": ["48,21 55,21 57,30 57,45 44,46 45,31"],
  "charcoal-cargo": ["40,45 59,45 63,58 64,88 53,89 49,66 43,90 31,89 33,63"],
  "retro-sneakers": [
    "31,88 43,88 45,93 42,96 25,96 24,94",
    "53,88 63,87 67,92 65,95 53,93",
  ],
  "cropped-jacket": [
    "37,19 47,19 47,25 43,32 42,44 29,46 31,29",
    "56,18 65,19 72,26 72,37 66,42 59,38 58,29",
  ],
  "navy-dress": ["47,24 56,23 59,30 59,40 63,57 67,78 54,81 36,78 40,58 44,38"],
  "silver-sandals": [
    "33,86 40,85 42,91 39,95 28,96 27,94",
    "54,87 61,88 67,93 65,96 53,95",
  ],
  "cropped-denim-jacket": [
    "27,19 72,19 77,29 69,46 59,40 58,50 39,50 38,41 28,48 22,31",
  ],
  "clean-white-tank": ["43,22 57,22 60,35 58,47 40,47 40,34"],
  "indigo-wide-jeans": ["38,45 61,45 67,91 53,92 49,60 46,92 31,91"],
  "silver-court-sneakers": [
    "31,89 46,89 47,96 30,97",
    "52,89 65,90 70,96 52,96",
  ],
  "burgundy-cardigan": [
    "29,20 70,20 76,34 68,52 58,46 57,54 39,54 38,47 28,55 23,34",
  ],
  "blue-oxford-shirt": ["41,19 58,19 60,31 59,51 39,51 40,31"],
  "charcoal-pleated-trousers": ["36,47 63,47 66,91 52,92 49,59 46,92 32,91"],
  "chunky-black-loafers": [
    "29,89 46,89 47,96 28,97",
    "52,89 65,89 70,96 51,96",
  ],
  "chartreuse-track-jacket": [
    "22,18 77,18 83,33 73,45 60,38 59,48 39,48 38,39 27,47 16,34",
  ],
  "black-performance-top": ["41,22 59,22 61,42 58,49 40,49 38,42"],
  "flared-leggings": ["38,46 62,46 68,92 52,92 49,59 45,92 30,92"],
  "sculptural-runners": ["28,89 45,89 46,97 26,98", "52,89 67,89 73,96 52,97"],
  "black-leather-bomber": [
    "27,19 72,19 78,33 69,49 59,42 58,51 39,51 38,44 29,52 22,34",
  ],
  "gray-fine-knit": ["42,20 58,20 60,35 58,49 40,49 40,34"],
  "black-volume-trousers": ["36,47 63,47 67,91 52,92 49,60 45,92 31,91"],
  "sleek-ankle-boots": ["29,88 46,88 47,96 28,97", "52,88 65,88 69,96 51,96"],
};
