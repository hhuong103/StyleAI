CATEGORIES = {
    "T_SHIRT": ("Áo thun", "TOP", 179000),
    "OVERSIZED_TEE": ("Áo thun oversized", "TOP", 229000),
    "SHIRT": ("Áo sơ mi", "TOP", 249000),
    "BLOUSE": ("Áo blouse", "TOP", 279000),
    "POLO": ("Áo polo", "TOP", 259000),
    "SWEATSHIRT": ("Áo sweatshirt", "TOP", 299000),
    "JEANS": ("Quần jeans", "BOTTOM", 329000),
    "TROUSERS": ("Quần âu", "BOTTOM", 349000),
    "WIDE_LEG_PANTS": ("Quần ống rộng", "BOTTOM", 329000),
    "SKIRT": ("Chân váy", "BOTTOM", 269000),
    "CARGO": ("Quần cargo", "BOTTOM", 349000),
    "SHORTS": ("Quần short", "BOTTOM", 219000),
    "JOGGERS": ("Quần jogger", "BOTTOM", 299000),
    "BLAZER": ("Áo blazer", "OUTERWEAR", 499000),
    "CARDIGAN": ("Áo cardigan", "OUTERWEAR", 329000),
    "DENIM_JACKET": ("Áo khoác denim", "OUTERWEAR", 399000),
    "LIGHT_JACKET": ("Áo khoác nhẹ", "OUTERWEAR", 349000),
    "LOAFERS": ("Giày loafer", "SHOES", 199000),
    "SNEAKERS": ("Giày sneaker", "SHOES", 329000),
    "FLATS": ("Giày bệt", "SHOES", 229000),
    "SANDALS": ("Giày sandal", "SHOES", 179000),
    "DRESS_SHOES": ("Giày tây", "SHOES", 349000),
}
STYLES = {
    "MINIMAL": "Tối giản",
    "FORMAL": "Trang trọng",
    "SMART_CASUAL": "Thanh lịch",
    "CASUAL": "Thoải mái",
    "STREETWEAR": "Đường phố",
    "KOREAN": "Hàn Quốc",
    "SPORTY": "Thể thao",
    "VINTAGE": "Cổ điển",
}
OCCASIONS = {
    "INTERVIEW": "Phỏng vấn",
    "OFFICE": "Công sở",
    "CAFE": "Cà phê",
    "DATE": "Hẹn hò",
    "PARTY": "Tiệc",
    "TRAVEL": "Du lịch",
    "DAILY": "Hằng ngày",
}
COLORS = {
    "BLACK": ("Đen", "#252525", "NEUTRAL"),
    "WHITE": ("Trắng", "#eeeae0", "NEUTRAL"),
    "BEIGE": ("Be", "#c8b79e", "NEUTRAL"),
    "GREY": ("Xám", "#8e9395", "NEUTRAL"),
    "NAVY": ("Xanh navy", "#303c50", "NEUTRAL"),
    "BLUE": ("Xanh dương", "#64869e", "COOL"),
    "BROWN": ("Nâu", "#806451", "NEUTRAL"),
    "GREEN": ("Xanh lá", "#677b61", "COOL"),
    "RED": ("Đỏ", "#a4493e", "WARM"),
    "PINK": ("Hồng", "#ce9e9e", "WARM"),
    "YELLOW": ("Vàng", "#cbb369", "WARM"),
    "PURPLE": ("Tím", "#9b8ba9", "COOL"),
}
RULES = [
    ("INTERVIEW", "MINIMAL", ["SHIRT", "BLAZER", "TROUSERS", "LOAFERS"]),
    ("INTERVIEW", "FORMAL", ["SHIRT", "BLAZER", "TROUSERS", "DRESS_SHOES"]),
    ("OFFICE", "MINIMAL", ["SHIRT/BLOUSE", "TROUSERS", "LOAFERS"]),
    ("OFFICE", "FORMAL", ["SHIRT", "BLAZER", "TROUSERS", "DRESS_SHOES"]),
    ("OFFICE", "SMART_CASUAL", ["SHIRT/POLO", "TROUSERS", "LOAFERS"]),
    ("CAFE", "CASUAL", ["T_SHIRT", "JEANS", "SNEAKERS"]),
    ("CAFE", "MINIMAL", ["SHIRT", "WIDE_LEG_PANTS", "LOAFERS"]),
    ("CAFE", "KOREAN", ["SHIRT", "CARDIGAN", "JEANS", "SNEAKERS"]),
    ("DATE", "MINIMAL", ["SHIRT/BLOUSE", "WIDE_LEG_PANTS/SKIRT", "LOAFERS/FLATS"]),
    ("DATE", "SMART_CASUAL", ["SHIRT", "TROUSERS", "LOAFERS"]),
    ("PARTY", "MINIMAL", ["BLOUSE/SHIRT", "BLAZER", "TROUSERS/SKIRT", "LOAFERS/FLATS"]),
    ("TRAVEL", "CASUAL", ["T_SHIRT", "LIGHT_JACKET", "JEANS", "SNEAKERS"]),
    ("TRAVEL", "SPORTY", ["T_SHIRT", "LIGHT_JACKET", "JOGGERS", "SNEAKERS"]),
    ("DAILY", "STREETWEAR", ["OVERSIZED_TEE", "CARGO/JEANS", "SNEAKERS"]),
    ("DAILY", "CASUAL", ["T_SHIRT", "JEANS/SHORTS", "SNEAKERS"]),
    ("DAILY", "VINTAGE", ["SHIRT", "DENIM_JACKET", "JEANS", "LOAFERS"]),
]


def rule_slots(categories):
    return [
        {
            "slot_key": CATEGORIES[c.split("/")[0]][1].lower(),
            "role": CATEGORIES[c.split("/")[0]][1],
            "categories": c.split("/"),
            "required": True,
        }
        for c in categories
    ]
