"use client";
import { useI18n } from "@/components/locale-provider";
import Link from "next/link";
import { editorialLooks } from "@/lib/editorial";
export default function Page() {
  const { tr, label, money, productName, localeTag } = useI18n();
  return (
    <div className="container page">
      <p className="eyebrow">{tr("THE CURATED EDIT")}</p>
      <div className="section-heading">
        <h1>
          {tr("Kh\u00F4ng ch\u1EC9 l\u00E0")}
          <br />
          <em>{tr("t\u1EEBng m\u00F3n \u0111\u1ED3.")}</em>
        </h1>
        <p>
          {tr(
            "C\u1EA3m h\u1EE9ng b\u1EAFt \u0111\u1EA7u t\u1EEB nh\u1EEFng l\u1EF1a ch\u1ECDn c\u00F3 ch\u1EE7 \u0111\u00EDch. M\u1EDF AI Stylist \u0111\u1EC3 kh\u00E1m ph\u00E1 m\u1ED9t Look d\u00E0nh cho b\u1EA1n.",
          )}
        </p>
      </div>
      <div className="editorial-grid">
        {["OFFICE", "CAFE", "DATE"].map((occasion, i) => (
          <Link
            className={`editorial-tile photographic-tile ${["beige", "blue", "dark"][i]}`}
            href={`/stylist?occasion=${occasion}`}
            key={occasion}
          >
            <p className="eyebrow">
              {
                [
                  tr("01 / THE OFFICE EDIT"),
                  tr("02 / COFFEE & CONVERSATION"),
                  tr("03 / AFTER HOURS"),
                ][i]
              }
            </p>
            <img
              src={editorialLooks[i].image}
              alt={tr(editorialLooks[i].alt)}
              width={900}
              height={1350}
              loading="lazy"
            />
            <div>
              <h3>
                {
                  [
                    tr("A confident first impression."),
                    tr("Comfort, with character."),
                    tr("A little more memorable."),
                  ][i]
                }
              </h3>
              <p>{tr("Kh\u00E1m ph\u00E1 v\u1EDBi AI Stylist \u2192")}</p>
            </div>
          </Link>
        ))}
      </div>
      <p className="fine-print">
        {tr(
          "Ảnh thời trang mang tính cảm hứng. AI Stylist sẽ chọn sản phẩm thực sự tồn tại trong catalog DEMO.",
        )}
      </p>
    </div>
  );
}
