"use client";

import Image from "next/image";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Expand,
  ShoppingBag,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/locale-provider";
import { TransitionLink } from "@/components/route-transition";
import {
  runwayProductUrl,
  shopeeUrl,
  type FeaturedLook,
  type LookProduct,
} from "@/lib/runway";

export function RunwayProductDetail({
  look,
  product,
}: {
  look: FeaturedLook;
  product: LookProduct;
}) {
  const { tr, money } = useI18n();
  const [view, setView] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const zoom = useRef<HTMLDialogElement>(null);
  const labels = ["Front view", "Walking pose", "Back view"];
  const hasPoses = look.hasPoses ?? look.image.startsWith("/");
  const sheet = hasPoses ? `/images/shop-the-look/${look.id}-poses.png` : null;
  const viewLabels = hasPoses ? labels : labels.slice(0, 1);

  useEffect(() => {
    document
      .querySelector<HTMLHeadingElement>(".runway-product-info h1")
      ?.focus({ preventScroll: true });
  }, []);

  function photo(selectedView: number, large = false) {
    return selectedView === 0 ? (
      <Image
        src={look.image}
        alt={tr(look.alt)}
        fill
        priority={large}
        sizes={large ? "(max-width: 767px) 92vw, 44vw" : "80px"}
      />
    ) : (
      <img
        className={`pose-sheet pose-sheet-${selectedView}`}
        src={sheet ?? ""}
        alt={`${tr(look.alt)} — ${tr(labels[selectedView])}`}
      />
    );
  }

  return (
    <article className="runway-product container">
      <div className="runway-product-topbar">
        <TransitionLink href="/" className="runway-back">
          <ArrowLeft size={16} />
          {tr("Back to the runway")}
        </TransitionLink>
        <span>
          {tr(look.eyebrow)} / {tr("THE DETAILS")}
        </span>
      </div>
      <div className="runway-product-layout">
        <section
          className="runway-gallery"
          aria-label={tr("Model photo gallery")}
        >
          <div className="runway-gallery-main">
            <div key={view} className="runway-gallery-photo">
              {photo(view, true)}
            </div>
            <span className="runway-gallery-tag">
              {tr(labels[view])}{" "}
              <i>
                {String(view + 1).padStart(2, "0")} /{" "}
                {String(viewLabels.length).padStart(2, "0")}
              </i>
            </span>
            <button
              type="button"
              className="runway-zoom"
              aria-label={tr("Enlarge photo")}
              onClick={() => zoom.current?.showModal()}
            >
              <Expand size={18} />
            </button>
            <div className="runway-gallery-arrows">
              <button
                type="button"
                onClick={() => setView((view + 2) % viewLabels.length)}
                aria-label={tr("Previous photo")}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setView((view + 1) % viewLabels.length)}
                aria-label={tr("Next photo")}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div
            className="runway-gallery-thumbnails"
            role="group"
            aria-label={tr("Choose a photo")}
          >
            {viewLabels.map((label, index) => (
              <button
                key={label}
                type="button"
                aria-label={tr(label)}
                aria-pressed={view === index}
                onClick={() => setView(index)}
              >
                <span>{photo(index)}</span>
                <b>{tr(label)}</b>
              </button>
            ))}
          </div>
          <p className="runway-gallery-caption">
            {hasPoses
              ? tr("Three perspectives. One complete look.")
              : tr("One complete look.")}
          </p>
        </section>
        <div className="runway-product-info">
          <p className="eyebrow">
            {tr(look.title)} / {tr("SELECTED PIECE")}
          </p>
          <h1 tabIndex={-1}>{tr(product.name)}</h1>
          <div className="runway-price">
            <strong>{money(product.price)}</strong>
            <span>{tr("Guide price")}</span>
          </div>
          <p className="runway-product-description">
            {tr(product.description)}
          </p>
          <fieldset className="runway-size-picker">
            <legend>
              {tr("Choose your size")}
              <span>{size || tr("Select a size")}</span>
            </legend>
            <div>
              {product.sizes.map((entry) => (
                <button
                  type="button"
                  key={entry}
                  aria-pressed={size === entry}
                  onClick={() => setSize(entry)}
                >
                  {entry}
                  {size === entry && <Check size={11} />}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="runway-size-note">
            {tr(
              "Sizes are style references. Check the seller's measurements before ordering.",
            )}
          </p>
          <a
            className="runway-shopee"
            href={shopeeUrl(product, size)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ShoppingBag size={19} />
            {tr(
              product.purchaseUrl
                ? "Buy on Shopee"
                : "Find this style on Shopee",
            )}
            <ArrowUpRight size={19} />
          </a>
          <p className="runway-seller-note">
            {tr(
              "Editorial outfit inspiration. Images are illustrative and prices are estimates. The Shopee link searches for similar items; confirm the product, size and final price with the seller.",
            )}
          </p>
          <details className="runway-product-details" open>
            <summary>{tr("The styling notes")}</summary>
            <p>{tr(look.subtitle)}</p>
            <p>
              {tr(
                "Explore the full outfit in the gallery, then choose each piece below to build your own version.",
              )}
            </p>
          </details>
          <section
            className="runway-complete"
            aria-label={tr("Every piece in this look")}
          >
            <h2>{tr("Make it a full look")}</h2>
            {look.products.map((entry, index) => (
              <TransitionLink
                key={entry.id}
                href={runwayProductUrl(look, entry)}
                className={entry.id === product.id ? "is-selected" : ""}
                aria-current={entry.id === product.id ? "page" : undefined}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{tr(entry.name)}</h3>
                  <p>{money(entry.price)}</p>
                </div>
                {entry.id === product.id ? (
                  <Check size={17} />
                ) : (
                  <ArrowUpRight size={17} />
                )}
              </TransitionLink>
            ))}
          </section>
        </div>
      </div>
      <dialog
        ref={zoom}
        className="runway-photo-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget) zoom.current?.close();
        }}
        aria-label={tr("Enlarged model photo")}
      >
        <button
          type="button"
          autoFocus
          aria-label={tr("Close photo")}
          onClick={() => zoom.current?.close()}
        >
          <X size={22} />
        </button>
        <div className="runway-dialog-image">{photo(view, true)}</div>
      </dialog>
    </article>
  );
}
