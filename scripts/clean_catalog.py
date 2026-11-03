"""Normalize canonical CSV/JSON before admin import. No remote downloads or DB writes."""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "apps/api"))

from app.core.schemas import ProductCreate
from app.modules.admin.router import parse_catalog
from app.modules.stylist.taxonomy import CATEGORIES, COLORS, OCCASIONS, RULES, STYLES


def code(value):
    return re.sub(r"[\s-]+", "_", str(value).strip().upper())


def clean(records, media_root):
    output, rejected, seen_codes, seen_skus = [], [], set(), set()
    for index, raw in enumerate(records, 1):
        try:
            row = dict(raw)
            row["category_code"] = {
                "TSHIRT": "T_SHIRT",
                "TEE": "T_SHIRT",
                "PANTS": "TROUSERS",
            }.get(code(row["category_code"]), code(row["category_code"]))
            row["color_code"] = {"GRAY": "GREY"}.get(
                code(row["color_code"]), code(row["color_code"])
            )
            row["gender"] = code(row.get("gender", "UNISEX"))
            if (
                row["category_code"] not in CATEGORIES
                or row["color_code"] not in COLORS
            ):
                raise ValueError(
                    "Unmapped category/color; update taxonomy mapping explicitly"
                )
            matching = [
                (o, s)
                for o, s, groups in RULES
                if any(row["category_code"] in c.split("/") for c in groups)
            ]
            row["styles"] = [
                code(c) for c in row.get("styles") or sorted({s for _, s in matching})
            ]
            row["occasions"] = [
                code(c)
                for c in row.get("occasions") or sorted({o for o, _ in matching})
            ]
            if (
                not set(row["styles"]) <= STYLES.keys()
                or not set(row["occasions"]) <= OCCASIONS.keys()
            ):
                raise ValueError("Unmapped style/occasion")
            product = ProductCreate.model_validate(row)
            path = (media_root / product.image_key).resolve()
            if (
                not path.is_relative_to(media_root.resolve())
                or not path.is_file()
                or not product.image_key.startswith(("demo/", "uploads/"))
            ):
                raise ValueError("Missing or invalid local image")
            skus = [v.sku for v in product.variants]
            if (
                product.product_code in seen_codes
                or len(set(skus)) != len(skus)
                or any(s in seen_skus for s in skus)
            ):
                raise ValueError("Duplicate product code or SKU")
            if len({v.size_code for v in product.variants}) != len(product.variants):
                raise ValueError("Duplicate size")
            seen_codes.add(product.product_code)
            seen_skus.update(skus)
            output.append(product.model_dump())
        except (ValueError, KeyError, TypeError) as error:
            rejected.append({"record": index, "message": str(error)[:300]})
    return output, rejected


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--media-root", required=True, type=Path)
    args = parser.parse_args()
    raw = args.input.read_bytes()
    records = parse_catalog(raw, args.input.name)
    output, rejected = clean(records, args.media_root)
    encoded = (json.dumps(output, ensure_ascii=False, indent=2) + "\n").encode()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(encoded)
    report = {
        "input_file": args.input.name,
        "raw_records": len(records),
        "clean_products": len(output),
        "rejected_records": len(rejected),
        "errors": rejected,
        "input_sha256": hashlib.sha256(raw).hexdigest(),
        "output_sha256": hashlib.sha256(encoded).hexdigest(),
        "mapping_version": "taxonomy-seed-v1",
        "inferred_tags": "Missing style/occasion tags inferred from versioned outfit rules; review before production",
        "source_and_license_review_required": True,
    }
    args.output.with_suffix(".report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    )
    print(
        json.dumps(
            {k: v for k, v in report.items() if k != "errors"}, ensure_ascii=False
        )
    )


if __name__ == "__main__":
    main()
