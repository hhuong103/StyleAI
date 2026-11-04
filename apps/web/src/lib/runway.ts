export type LookProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  sizes: string[];
  price: number;
  hotspot: { x: number; y: number };
  purchaseUrl?: string;
  /** Standalone transparent product photography used by the hover inspector. */
  packshot?: string;
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
    hasPoses: true,
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
        packshot: "/images/products/city-denim/cropped-denim-jacket.png",
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
        packshot: "/images/products/city-denim/clean-white-tank.png",
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
        packshot: "/images/products/city-denim/indigo-wide-jeans.png",
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
        packshot: "/images/products/city-denim/silver-court-sneakers.png",
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
    hasPoses: true,
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
        packshot: "/images/products/neo-prep/burgundy-cardigan.png",
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
        packshot: "/images/products/neo-prep/blue-oxford-shirt.png",
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
        packshot: "/images/products/neo-prep/charcoal-pleated-trousers.png",
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
        packshot: "/images/products/neo-prep/chunky-black-loafers.png",
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
    hasPoses: true,
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
        packshot:
          "/images/products/elevated-active/chartreuse-track-jacket.png",
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
        packshot: "/images/products/elevated-active/black-performance-top.png",
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
        packshot: "/images/products/elevated-active/flared-leggings.png",
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
        packshot: "/images/products/elevated-active/sculptural-runners.png",
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
    hasPoses: true,
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
        packshot: "/images/products/monochrome-edge/black-leather-bomber.png",
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
        packshot: "/images/products/monochrome-edge/gray-fine-knit.png",
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
        packshot: "/images/products/monochrome-edge/black-volume-trousers.png",
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
        packshot: "/images/products/monochrome-edge/sleek-ankle-boots.png",
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
    "25,18 74,18 79,31 78,40 72,49 66,44 60,51 39,51 34,46 29,51 23,45 21,34",
  ],
  "gray-fine-knit": ["42,16 58,16 60,29 59,43 41,43 40,29"],
  "black-volume-trousers": ["35,42 64,42 68,91 52,92 49,57 46,92 30,91"],
  "sleek-ankle-boots": ["28,89 46,89 47,97 27,98", "51,89 66,89 70,97 50,97"],
};

// Visible contours are deliberately separate from the generous hit areas above.
// Each point follows the photographed garment edge; these shapes never receive input.
export const garmentOutlineAreas: Record<string, string[]> = {
  "ivory-blouse": [
    "40,17 54,17 58,19 63,21 67,24 70,27 73,32 70,36 66,33 63,28 60,35 58,35 57,24 54,21 54,35 40,35 39,23 35,22 33,27 32,35 30,42 27,48 24,46 27,40 28,33 30,25 34,20",
  ],
  "red-skirt": ["39,34 60,34 61,38 64,44 68,54 61,56 49,58 38,56 33,54 36,44"],
  "white-sneakers": [
    "24,88 32,88 35,91 35,94 31,95 23,95 22,93",
    "54,88 62,88 66,91 68,94 65,96 57,95 53,93",
  ],
  "sand-blazer": [
    "35,20 46,19 48,22 47,28 45,36 44,46 43,53 37,54 31,53 30,44 31,35 32,26",
    "55,21 62,20 67,23 70,27 71,35 73,43 70,49 68,53 63,53 58,50 57,38 56,28",
  ],
  "ivory-knit": ["48,19 55,20 57,25 57,32 56,39 46,40 46,30"],
  "cream-trousers": [
    "43,39 57,39 59,45 60,55 60,87 57,90 52,89 50,61 48,59 45,89 39,90 33,89 35,62 36,52 39,43",
  ],
  "brown-loafers": [
    "31,89 40,88 43,90 43,93 39,95 29,96 27,94",
    "52,89 59,88 62,90 64,94 62,96 54,95 52,93",
  ],
  "green-overshirt": [
    "34,18 46,18 48,21 47,27 45,36 44,48 40,50 31,49 30,41 31,32 32,24",
    "56,19 63,19 69,23 71,29 72,37 74,44 71,50 64,51 58,49 57,36 56,25",
  ],
  "heavy-tee": ["48,21 55,21 57,25 57,44 54,46 44,46 45,31"],
  "charcoal-cargo": [
    "40,45 59,45 61,51 63,60 64,86 62,89 54,89 50,66 48,66 43,90 35,90 31,88 33,64 35,53",
  ],
  "retro-sneakers": [
    "31,88 41,88 44,90 45,93 42,96 29,96 24,94 26,91",
    "53,88 62,87 65,89 68,92 65,95 56,94 53,92",
  ],
  "cropped-jacket": [
    "37,19 47,19 48,22 46,27 44,32 43,42 40,45 29,46 30,37 31,29 34,22",
    "56,18 65,19 70,23 73,28 73,36 70,40 66,42 61,39 59,34 58,27",
  ],
  "navy-dress": [
    "47,24 55,23 58,27 59,35 59,43 62,54 65,68 67,78 62,80 54,81 45,80 36,78 39,65 41,54 43,39",
  ],
  "silver-sandals": [
    "33,86 39,85 41,88 42,91 39,94 31,96 28,94 30,90",
    "54,87 60,88 64,90 67,93 65,96 57,95 53,93",
  ],
  "cropped-denim-jacket": [
    "28,18 42,18 46,21 45,27 44,36 42,48 39,50 35,50 32,47 30,39 28,49 25,48 25,41 23,31 25,23",
    "55,19 68,18 73,20 76,25 78,31 76,38 72,46 68,44 65,40 62,48 58,50 57,39 56,29",
  ],
  "clean-white-tank": ["46,22 55,22 58,27 58,38 57,46 43,46 42,38 43,28"],
  "indigo-wide-jeans": [
    "39,45 60,45 62,51 63,61 66,82 67,90 63,92 54,91 51,68 49,60 47,67 46,91 38,92 31,90 33,72 34,58",
  ],
  "silver-court-sneakers": [
    "31,90 42,89 46,92 46,95 42,97 31,97 28,95",
    "53,90 63,90 67,92 70,95 67,97 55,96 52,94",
  ],
  "burgundy-cardigan": [
    "29,20 43,20 47,23 46,29 44,37 42,50 39,53 34,53 30,50 29,42 28,49 25,51 24,42 23,33 25,25",
    "55,20 68,20 72,23 75,29 77,35 76,42 73,51 69,50 67,44 63,51 58,53 57,39 56,28",
  ],
  "blue-oxford-shirt": [
    "47,17 54,17 56,21 54,26 50,24 47,26 45,21",
    "42,44 58,44 59,49 57,52 51,51 48,50 43,51 41,48",
  ],
  "charcoal-pleated-trousers": [
    "37,47 62,47 64,54 65,66 66,88 63,91 53,91 51,65 49,59 47,66 46,91 37,92 32,90 34,67 35,55",
  ],
  "chunky-black-loafers": [
    "30,89 42,88 46,91 46,94 42,96 29,97 27,94",
    "52,89 63,89 67,92 70,95 67,97 54,96 51,94",
  ],
  "chartreuse-track-jacket": [
    "23,18 43,18 46,21 45,28 43,35 41,45 38,48 33,47 30,43 27,47 23,43 20,36 17,32 19,25",
    "56,18 76,18 80,23 82,30 84,34 80,40 77,45 73,47 69,42 66,47 61,48 59,38 57,28",
  ],
  "black-performance-top": [
    "46,22 56,22 59,27 59,37 58,45 55,48 43,48 41,44 41,35 43,27",
  ],
  "flared-leggings": [
    "39,46 61,46 63,54 64,64 67,78 68,91 64,93 53,92 51,68 49,59 47,68 45,92 35,93 30,91 33,78 35,63 36,54",
  ],
  "sculptural-runners": [
    "28,90 41,89 45,92 46,95 42,98 30,98 26,96",
    "53,90 65,89 69,92 73,95 69,97 56,97 52,95",
  ],
  "black-leather-bomber": [
    "43,17 35,18 30,20 27,24 25,29 23,36 24,43 26,47 29,49 31,47 34,49 39,49 41,44 43,40 44,31 44,22",
    "56,17 65,18 70,20 74,24 77,29 79,35 77,40 73,47 69,45 66,41 63,47 60,49 57,49 56,39 55,30 55,22",
  ],
  "gray-fine-knit": [
    "44,17 56,17 57,20 57,27 58,34 57,41 54,43 44,43 42,40 42,33 43,25 43,20",
  ],
  "black-volume-trousers": [
    "38,42 62,42 64,46 64,55 66,68 67,87 64,91 53,91 51,68 50,57 48,68 46,91 36,92 31,90 33,70 35,55 35,46",
  ],
  "sleek-ankle-boots": [
    "31,89 42,89 45,91 46,95 43,97 30,98 27,96 28,92",
    "53,89 63,89 66,91 69,95 67,97 54,97 51,95 52,91",
  ],
};

// Tighter masks used by the side preview. Open jackets are split into left and
// right panels so the layer underneath is never shown as part of the selected item.
export const garmentPreviewAreas: Record<string, string[]> = {
  "ivory-knit": ["48,20 55,21 56,29 55,38 47,38 47,29"],
  "heavy-tee": ["47,22 55,22 56,30 56,44 45,44 46,31"],
  "cropped-denim-jacket": [
    "27,19 45,19 44,29 42,49 39,50 38,41 28,48 22,31",
    "55,19 72,19 77,29 69,46 59,40 58,50 56,34",
  ],
  "clean-white-tank": ["46,23 56,23 57,31 56,39 43,39 43,31"],
  "burgundy-cardigan": [
    "29,20 45,20 46,31 43,52 39,54 38,47 28,55 23,34",
    "55,20 70,20 76,34 68,52 58,46 57,54 54,31",
  ],
  "blue-oxford-shirt": ["47,18 55,18 56,27 46,27", "44,45 58,45 58,50 43,50"],
  "chartreuse-track-jacket": [
    "22,18 45,18 45,30 42,47 39,48 38,39 27,47 16,34",
    "55,18 77,18 83,33 73,45 60,38 59,48 56,30",
  ],
  "black-performance-top": ["47,23 57,23 57,36 47,36"],
  "black-leather-bomber": [
    "27,19 45,19 45,31 42,50 39,51 38,44 29,52 22,34",
    "55,19 72,19 78,33 69,49 59,42 58,51 56,31",
  ],
  "gray-fine-knit": ["45,21 57,21 58,31 57,43 43,43 43,30"],
  "navy-dress": ["43,38 58,38 59,46 63,57 67,78 54,81 36,78 40,58"],
};
