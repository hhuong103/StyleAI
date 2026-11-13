export type LookProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  sizes: string[];
  price: number;
  hotspot: { x: number; y: number };
  /** Standalone transparent product photography used by the hover inspector. */
  packshot: string;
  thumbnail?: string;
  thumbnailPosition?: string;
};

export type ShopeeProductMatch = {
  url: string;
  /** Product name shown by Shopee, kept separate from the editorial name. */
  listingTitle: string;
  matchedAttributes: readonly string[];
  verifiedAt: string;
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

const shopeeListing = {
  blouse:
    "https://shopee.vn/Áo-Sơ-Mi-Dài-Tay-NOAM-Nafox-Oxford-Màu-Trắng-Xanh-Tím-Be-Hồng-Kẻ-Hồng-Kẻ-Đỏ-Kẻ-Xanh-Kẻ-Tím-i.922211543.43103321980",
  skirt:
    "https://shopee.vn/Chân-váy-ngắn-chữ-A-dáng-ôm-nỉ-2-da-co-giãn-mềm-mại-tôn-dáng-CV11-i.366027874.43517419917",
  womenSneakers:
    "https://shopee.vn/Giày-nữ-thể-thao-full-trắng-đế-cao-hàng-QCCC-ELINE-i.225185899.26101201266",
  blazer:
    "https://shopee.vn/Áo-blazer-nữ-2-lớp-áo-vest-dài-tay-cao-cấp-có-5-màu-đen-nâu-be-phong-cách-hàn-quốc-Thời-trang-SHOPLORA-MS005-i.244507014.7157723091",
  knit: "https://shopee.vn/TRENDO-Áo-len-nam-nữ-cổ-tròn-mùa-đông-áo-dài-tay-dệt-kim-màu-trơn-màu-xám-nhạt-i.1284180167.42477526856",
  womenTrousers:
    "https://shopee.vn/Quần-Tây-Ống-Suông-Nữ-SOTANO-Cạp-Cao-Khóa-Trước-Form-Rộng-Che-Khuyết-Điểm-i.1844848037.29495268069",
  loafers:
    "https://shopee.vn/Ảnh-thật-Hàng-Sẵn-Giày-Loafer-nữ-chất-da-mềm-đế-bệt-mũi-tròn-đính-khuy-cài-i.559337405.45367800285",
  overshirt:
    "https://shopee.vn/Áo-sơ-mi-nam-kiểu-dáng-basic-TOPMEN-khoác-ngoài-chất-vải-kaki-cao-cấp-i.924819450.22216000773",
  cargo:
    "https://shopee.vn/Quần-Cargo-Pant-Kaki-DINOMAN-x-Yumi-Quần-Túi-Hộp-Nam-Nữ-Dáng-Suông-Rộng-QTH01-2-i.492542376.25706147282",
  menSneakers:
    "https://shopee.vn/Giày-thể-thao-sneaker-nam-màu-trắng-đế-cao-khâu-đế-đủ-size-K01-i.937891140.25358177675",
  dress:
    "https://shopee.vn/ĐẦM-MIDI-NAVY-CỔ-VUÔNG-XẾP-LY-i.20595662.42509467473",
  sandals:
    "https://shopee.vn/AD-SHOES-Sandal-Nữ-Bệt-dây-mảnh-Phong-Cách-Hiện-Đại-Có-Size-42-i.991218332.18579170323",
  cardigan:
    "https://shopee.vn/Áo-Cardigan-Nam-Dài-Tay-Chất-Vải-Len-Tăm-Cao-Cấp-Thu-Đông-Unisex-ARTGOD-HMK02-i.767331608.50651688993",
  tank: "https://shopee.vn/Áo-sát-nách-áo-3-lỗ-GÂN-TĂM-nữ-phom-ôm-không-đệm-ngực-ANHSTORE-i.194097580.22170056723",
  leggings:
    "https://shopee.vn/Quần-Legging-Nữ-Dài-Nâng-Mông-Cạp-Cao-Body-Leggin-Ôm-Bó-Co-Giãn-Vải-Dày-Mịn-i.259881145.5536939125",
  menTrousers:
    "https://shopee.vn/Quần-dài-Manor-Pants-Jack-Lane-Quần-âu-ống-rộng-xếp-ly-chất-liệu-vải-chéo-hàn-wide-leg-trousers-i.14016573.25502557341",
  menLoafers:
    "https://shopee.vn/Giày-da-nam-chunky-loafer-công-sở-thời-trang-INICHI-G1229-da-lì-đế-chunky-i.283264912.24671370745",
  trackJacket:
    "https://shopee.vn/Áo-khoác-gió-thể-thao-nữ-Windy-Jacket-Today-U-Wear-chống-nước-nhẹ-cản-gió-bụi-i.27395297.27115955949",
  leatherJacket:
    "https://shopee.vn/Áo-khoác-da-ONER-Simon-Crimson-Leather-Jacket-da-PU-cao-cấp-i.625004292.27873185032",
  grayKnit:
    "https://shopee.vn/TRENDO-Áo-len-nam-nữ-cổ-tròn-mùa-đông-áo-dài-tay-dệt-kim-màu-trơn-màu-xám-nhạt-i.1284180167.42477526856",
  boots:
    "https://shopee.vn/Giày-Boot-Nam-Cổ-Thấp-Đế-Bằng-Màu-Đen-Thiết-Kế-Tối-Giản-Sang-Trọng-Dễ-Phối-Đồ-GN497-i.63371668.54550093736",
  heavyweightWhiteTee:
    "https://shopee.vn/Áo-phông-form-rộng-GOPYA-tay-lỡ-TRƠN-Unisex-nam-nữ-đều-mặc-được-100-cotton-áo-thun-local-brand-i.867280831.17798993353",
  croppedBlackBlazer:
    "https://shopee.vn/Áo-Blazer-Croptop-Nữ-Dáng-Ngắn-Mùa-Hè-Form-Chuẩn-Dễ-Phối-Đồ-Áo-Khoác-Croptop-2-Khuy-Chất-Tuyết-Mưa-Cao-Cấp-Hàn-Quốc-AK07-i.156605028.20472344319",
  croppedDenimJacket:
    "https://shopee.vn/Áo-khoác-Jeans-Croptop-MẪU-MỚI-túi-ngực-form-unisex-màu-wash-denim-i.133568697.40012584892",
  blueOxfordShirt:
    "https://shopee.vn/Owen-Áo-sơ-mi-dài-tay-J-Form-AJ250007DT-màu-Xanh-nhạt-chất-liệu-Oxford-i.92937520.41357966089",
  indigoWideJeans:
    "https://shopee.vn/Quần-Jean-Ống-Rộng-Nữ-quần-jeans-trơn-màu-xanh-đậm-phối-chỉ-nổi-cạp-cao-hack-dáng-i.33680938.26221160998",
  flaredBlackLeggings:
    "https://shopee.vn/Quần-ống-loe-cạp-cao-XINHQUEEN-Quần-legging-ống-loe-nữ-ôm-body-dáng-dài-tôn-dáng-màu-Đen-Trơn-i.115081073.14879844468",
  blackLeatherBoxyJacket:
    "https://shopee.vn/Áo-Khoác-Da-Cổ-Bẻ-COOLCREW-Dáng-Boxy-Unisex-Nam-Nữ-Phong-Cách-Thời-Trang-Hàn-Quốc-04-AKD085-i.1388112438.56802493973",
  ivoryCrewKnit:
    "https://shopee.vn/Áo-len-nữ-màu-trắng-be-xanh-tím-phom-rộng-sweater-cổ-tròn-dài-tay-chất-len-vặn-thừng-dày-dặn-cao-cấp-phong-cách-Hàn-Quốc-i.307240387.13706292068",
  silverBlockHeelSandals:
    "https://shopee.vn/GIÀY-SANDAL-GSS85-NỮ-PHỐI-NƠ-ĐÁ-GÓT-VUÔNG-CAO-5P-MÀU-BẠC-SANG-TRỌNG-NHẸ-NHÀNG-PHÙ-HỢP-ĐI-TIỆC-i.1015149337.18484068351",
  silverReflectiveSneakers:
    "https://shopee.vn/Giày-Thể-Thao-Sneaker-Nữ-Gót-Bạc-Có-Phản-Quang-i.391816140.17318911152",
} as const;

const SHOPEE_WEB_LISTING_PATTERN = /^https:\/\/shopee\.vn\/.+-i\.\d+\.\d+$/u;

Object.entries(shopeeListing).forEach(([key, url]) => {
  if (!SHOPEE_WEB_LISTING_PATTERN.test(url)) {
    throw new Error(`Invalid Shopee web listing URL for ${key}`);
  }
});

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
        packshot: "/images/products/coral-weekend/ivory-blouse.png",
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
        packshot: "/images/products/coral-weekend/red-skirt.png",
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
        packshot: "/images/products/coral-weekend/white-sneakers.png",
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
        packshot: "/images/products/soft-tailoring/sand-blazer.png",
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
        packshot: "/images/products/soft-tailoring/ivory-knit.png",
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
        packshot: "/images/products/soft-tailoring/cream-trousers.png",
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
        packshot: "/images/products/soft-tailoring/brown-loafers.png",
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
        packshot: "/images/products/modern-utility/green-overshirt.png",
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
        packshot: "/images/products/modern-utility/heavy-tee.png",
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
        packshot: "/images/products/modern-utility/charcoal-cargo.png",
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
        packshot: "/images/products/modern-utility/retro-sneakers.png",
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
        packshot: "/images/products/after-dark/cropped-jacket.png",
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
        packshot: "/images/products/after-dark/navy-dress.png",
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
        packshot: "/images/products/after-dark/silver-sandals.png",
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

const VERIFIED_AT = "2026-11-05";

function verifiedShopeeMatch(
  url: string,
  listingTitle: string,
  ...matchedAttributes: string[]
): ShopeeProductMatch {
  return { url, listingTitle, matchedAttributes, verifiedAt: VERIFIED_AT };
}

/**
 * Product-level mapping. This intentionally uses product ids instead of broad
 * category keys so a T-shirt, blazer or shoe can never silently inherit the
 * listing of another garment.
 */
export const shopeeProductMatches: Record<string, ShopeeProductMatch> = {
  "ivory-blouse": verifiedShopeeMatch(
    shopeeListing.blouse,
    "Áo sơ mi dài tay Oxford màu trắng",
    "BLOUSE",
    "IVORY",
    "LONG_SLEEVE",
  ),
  "red-skirt": verifiedShopeeMatch(
    shopeeListing.skirt,
    "Chân váy ngắn chữ A dáng ôm CV11",
    "SKIRT",
    "RED",
    "A_LINE",
  ),
  "white-sneakers": verifiedShopeeMatch(
    shopeeListing.womenSneakers,
    "Giày nữ thể thao full trắng đế cao ELINE",
    "SNEAKERS",
    "WHITE",
  ),
  "sand-blazer": verifiedShopeeMatch(
    shopeeListing.blazer,
    "Áo blazer nữ hai lớp dáng dài SHOPLORA MS005",
    "BLAZER",
    "BEIGE",
    "LONG_LINE",
  ),
  "ivory-knit": verifiedShopeeMatch(
    shopeeListing.ivoryCrewKnit,
    "Áo len nữ trắng be cổ tròn dài tay",
    "T_SHIRT",
    "IVORY",
    "CREW_NECK",
  ),
  "cream-trousers": verifiedShopeeMatch(
    shopeeListing.womenTrousers,
    "Quần tây nữ ống suông cạp cao SOTANO",
    "TROUSERS",
    "CREAM",
    "STRAIGHT_LEG",
  ),
  "brown-loafers": verifiedShopeeMatch(
    shopeeListing.loafers,
    "Giày loafer nữ da mềm đế bệt mũi tròn",
    "LOAFERS",
    "BROWN",
  ),
  "green-overshirt": verifiedShopeeMatch(
    shopeeListing.overshirt,
    "Áo sơ mi nam khoác ngoài kaki TOPMEN",
    "LIGHT_JACKET",
    "GREEN",
  ),
  "heavy-tee": verifiedShopeeMatch(
    shopeeListing.heavyweightWhiteTee,
    "Áo phông trơn cotton form rộng GOPYA",
    "T_SHIRT",
    "WHITE",
    "RELAXED_FIT",
  ),
  "charcoal-cargo": verifiedShopeeMatch(
    shopeeListing.cargo,
    "Quần cargo túi hộp dáng suông rộng DINOMAN",
    "CARGO",
    "CHARCOAL",
    "WIDE_LEG",
  ),
  "retro-sneakers": verifiedShopeeMatch(
    shopeeListing.menSneakers,
    "Giày sneaker nam màu trắng đế cao K01",
    "SNEAKERS",
    "CREAM",
  ),
  "cropped-jacket": verifiedShopeeMatch(
    shopeeListing.croppedBlackBlazer,
    "Áo blazer croptop nữ dáng ngắn AK07",
    "BLAZER",
    "BLACK",
    "CROPPED",
  ),
  "navy-dress": verifiedShopeeMatch(
    shopeeListing.dress,
    "Đầm midi navy cổ vuông xếp ly",
    "DRESS",
    "NAVY",
    "MIDI",
  ),
  "silver-sandals": verifiedShopeeMatch(
    shopeeListing.silverBlockHeelSandals,
    "Sandal nữ GSS85 màu bạc gót vuông cao 5 cm",
    "SANDALS",
    "SILVER",
    "BLOCK_HEEL",
  ),
  "cropped-denim-jacket": verifiedShopeeMatch(
    shopeeListing.croppedDenimJacket,
    "Áo khoác jeans croptop túi ngực màu wash denim",
    "DENIM_JACKET",
    "BLUE",
    "CROPPED",
  ),
  "clean-white-tank": verifiedShopeeMatch(
    shopeeListing.tank,
    "Áo sát nách gân tăm nữ phom ôm ANHSTORE",
    "TANK_TOP",
    "WHITE",
  ),
  "indigo-wide-jeans": verifiedShopeeMatch(
    shopeeListing.indigoWideJeans,
    "Quần jean nữ ống rộng xanh đậm phối chỉ nổi",
    "JEANS",
    "INDIGO",
    "WIDE_LEG",
  ),
  "silver-court-sneakers": verifiedShopeeMatch(
    shopeeListing.silverReflectiveSneakers,
    "Giày thể thao sneaker nữ gót bạc có phản quang",
    "SNEAKERS",
    "SILVER",
    "LOW_PROFILE",
  ),
  "burgundy-cardigan": verifiedShopeeMatch(
    shopeeListing.cardigan,
    "Áo cardigan dài tay dệt kim ARTGOD HMK02",
    "CARDIGAN",
    "BURGUNDY",
  ),
  "blue-oxford-shirt": verifiedShopeeMatch(
    shopeeListing.blueOxfordShirt,
    "Owen AJ250007DT sơ mi Oxford xanh nhạt",
    "SHIRT",
    "LIGHT_BLUE",
    "OXFORD",
  ),
  "charcoal-pleated-trousers": verifiedShopeeMatch(
    shopeeListing.menTrousers,
    "Quần âu ống rộng xếp ly Manor Pants Jack Lane",
    "TROUSERS",
    "CHARCOAL",
    "PLEATED",
  ),
  "chunky-black-loafers": verifiedShopeeMatch(
    shopeeListing.menLoafers,
    "Giày da nam chunky loafer INICHI G1229",
    "LOAFERS",
    "BLACK",
    "CHUNKY_SOLE",
  ),
  "chartreuse-track-jacket": verifiedShopeeMatch(
    shopeeListing.trackJacket,
    "Áo khoác gió thể thao nữ Windy Jacket Today U Wear",
    "SPORT_JACKET",
    "CHARTREUSE",
    "CROPPED",
  ),
  "black-performance-top": verifiedShopeeMatch(
    shopeeListing.tank,
    "Áo sát nách gân tăm nữ phom ôm ANHSTORE",
    "SPORT_TOP",
    "BLACK",
    "FITTED",
  ),
  "flared-leggings": verifiedShopeeMatch(
    shopeeListing.flaredBlackLeggings,
    "Quần legging ống loe cạp cao màu đen trơn XINHQUEEN",
    "LEGGINGS",
    "BLACK",
    "FLARED",
  ),
  "sculptural-runners": verifiedShopeeMatch(
    shopeeListing.womenSneakers,
    "Giày nữ thể thao full trắng đế cao ELINE",
    "RUNNING_SHOES",
    "WHITE",
    "CUSHIONED_SOLE",
  ),
  "black-leather-bomber": verifiedShopeeMatch(
    shopeeListing.blackLeatherBoxyJacket,
    "Áo khoác da cổ bẻ dáng boxy COOLCREW AKD085",
    "BOMBER",
    "BLACK",
    "BOXY",
  ),
  "gray-fine-knit": verifiedShopeeMatch(
    shopeeListing.grayKnit,
    "Áo len cổ tròn dài tay dệt kim xám nhạt TRENDO",
    "KNITWEAR",
    "GRAY",
    "CREW_NECK",
  ),
  "black-volume-trousers": verifiedShopeeMatch(
    shopeeListing.menTrousers,
    "Quần âu ống rộng xếp ly Manor Pants Jack Lane",
    "TROUSERS",
    "BLACK",
    "WIDE_LEG",
  ),
  "sleek-ankle-boots": verifiedShopeeMatch(
    shopeeListing.boots,
    "Giày boot nam cổ thấp đế bằng màu đen GN497",
    "BOOTS",
    "BLACK",
    "ANKLE_HEIGHT",
  ),
};

const allRunwayProducts = featuredLooks.flatMap((look) => look.products);
const missingShopeeMatches = allRunwayProducts.filter(
  (product) => !shopeeProductMatches[product.id],
);

if (missingShopeeMatches.length > 0) {
  throw new Error(
    `Missing Shopee product mappings: ${missingShopeeMatches
      .map((product) => product.id)
      .join(", ")}`,
  );
}
export function findRunwayProduct(lookId: string, productId: string) {
  const look = featuredLooks.find((entry) => entry.id === lookId);
  const product = look?.products.find((entry) => entry.id === productId);
  return look && product ? { look, product } : null;
}

export function shopeeUrl(product: LookProduct) {
  return shopeeListingFor(product).url;
}

export function shopeeListingFor(product: LookProduct) {
  const listing = shopeeProductMatches[product.id];
  if (!listing) throw new Error(`Missing Shopee listing for ${product.id}`);
  return listing;
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
    "42,15.5 38.5,15.9 34,17.8 30.5,20.4 28,24.2 26,29.5 24.5,35.8 24.3,42.9 25.7,47 28.1,49.3 30.7,49.5 31.5,47.1 34.2,45.2 35.1,43.2 42.5,43 43.8,36 45.1,27.2 45.7,19.2 43.7,16.4",
    "53,16 57.5,16.2 65.5,18.2 71.5,22.9 75.1,27.2 77.5,30.2 77.3,35.5 74.6,38.5 71.5,40.8 67.7,42.4 65.7,40.5 62.7,41.2 60.6,42.5 58.9,37.2 56.3,27.3 53,19",
  ],
  "gray-fine-knit": [
    "44.7,16.3 52.1,16 53.3,18 54.2,23.8 55.4,30.2 57.6,40.9 54.7,41.8 49.7,42.3 43,42.5 42.6,40.8 43.7,31.8 44.8,23.7 45.8,19.1",
  ],
  "black-volume-trousers": [
    "35,41.3 61.2,40.9 64,43.2 64.6,49.6 65.6,61 66.3,76 65,91.8 59.2,93.2 52.6,92.5 50.5,69.5 49.6,55.4 48.3,69.5 46,92.5 39,93.2 29.6,92 31.6,76 31.2,62 32.5,49 33.8,43.5",
  ],
  "sleek-ankle-boots": [
    "31.7,91.6 40.8,91.5 43.8,93.2 44.4,96 41.5,97.5 31.2,98.1 25.7,97 25.4,95.4 27.4,93.1",
    "51.3,91.5 59.7,91.6 62.5,93.3 66.3,95.5 65.9,97.5 57.1,98.2 50.1,97 49,95 49.8,93",
  ],
};
