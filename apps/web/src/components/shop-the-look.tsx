"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  MousePointer2,
  Orbit,
  Sparkles,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useI18n } from "@/components/locale-provider";
import { TransitionLink } from "@/components/route-transition";
import { featuredLooks, garmentAreas, runwayProductUrl } from "@/lib/runway";

const STEP = (Math.PI * 2) / featuredLooks.length;

function orbitStyle(index: number, rotation: number): CSSProperties {
  const angle = index * STEP + rotation;
  const depth = (Math.cos(angle) + 1) / 2;
  const focus = depth ** 4;
  return {
    "--orbit-x": `${(Math.cos(angle) - 1) * 25 + Math.sin(angle) * 14}cqw`,
    "--orbit-y": `${-(1 - depth) * 12}cqh`,
    "--orbit-scale": 0.3 + focus * 0.7,
    "--orbit-blur": `${(1 - focus) * 5.5}px`,
    "--orbit-opacity": 0.14 + focus * 0.86,
    "--orbit-saturation": 0.05 + focus * 1.05,
    "--orbit-brightness": 0.14 + focus * 0.92,
    "--orbit-contrast": 1 + focus * 0.04,
    zIndex: Math.round(depth * 100) + 1,
  } as CSSProperties;
}

export function ShopTheLook() {
  const { tr, money, locale, setLocale } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const models = useRef<(HTMLDivElement | null)[]>([]);
  const rotation = useRef(0);
  const frame = useRef<number | null>(null);
  const busy = useRef(false);
  const dismiss = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewId = useId();
  const look = featuredLooks[activeIndex];
  const inspected = look.products.find((product) => product.id === inspectedId);

  const paintOrbit = useCallback((angle: number) => {
    models.current.forEach((model, index) => {
      if (!model) return;
      Object.entries(orbitStyle(index, angle)).forEach(([key, value]) => {
        if (key === "zIndex") model.style.zIndex = String(value);
        else model.style.setProperty(key, String(value));
      });
    });
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem("styleai-runway-look");
    const index = featuredLooks.findIndex((entry) => entry.id === saved);
    if (index >= 0) {
      rotation.current = -index * STEP;
      setActiveIndex(index);
      paintOrbit(rotation.current);
    }
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      if (dismiss.current) clearTimeout(dismiss.current);
    };
  }, [paintOrbit]);

  function keepPreview() {
    if (dismiss.current) clearTimeout(dismiss.current);
  }

  function inspect(id: string) {
    keepPreview();
    if (!busy.current) setInspectedId(id);
  }

  function dismissPreview() {
    keepPreview();
    dismiss.current = setTimeout(() => setInspectedId(null), 320);
  }

  function selectLook(index: number, forcedDirection?: number) {
    if (busy.current) return;
    const next = (index + featuredLooks.length) % featuredLooks.length;
    if (next === activeIndex) return;
    let distance = forcedDirection ?? next - activeIndex;
    if (distance > featuredLooks.length / 2) distance -= featuredLooks.length;
    if (distance < -featuredLooks.length / 2) distance += featuredLooks.length;
    const from = rotation.current;
    const target = from - distance * STEP;
    keepPreview();
    setInspectedId(null);
    setActiveIndex(next);
    sessionStorage.setItem("styleai-runway-look", featuredLooks[next].id);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      rotation.current = target;
      paintOrbit(target);
      return;
    }
    busy.current = true;
    setMoving(true);
    const start = performance.now();
    function animate(now: number) {
      const progress = Math.min((now - start) / 820, 1);
      const ease =
        progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      rotation.current = from + (target - from) * ease;
      paintOrbit(rotation.current);
      if (progress < 1) frame.current = requestAnimationFrame(animate);
      else {
        frame.current = null;
        busy.current = false;
        setMoving(false);
      }
    }
    frame.current = requestAnimationFrame(animate);
  }

  return (
    <section
      className="runway"
      aria-label={tr("Style runway")}
      aria-roledescription="carousel"
      onKeyDown={(event) => {
        if (event.key === "Escape") setInspectedId(null);
      }}
    >
      <div className="runway-preview-preload" aria-hidden="true">
        {featuredLooks.map((entry) => (
          <Image
            key={entry.id}
            src={entry.image}
            alt=""
            width={240}
            height={360}
            sizes="240px"
            loading="eager"
          />
        ))}
      </div>
      <div className="runway-topline">
        <span>
          <Sparkles size={13} />
          {tr("THE NEW GENERATION OF STYLE")}
        </span>
        <div
          className="shop-look-language"
          role="group"
          aria-label={tr("Language")}
        >
          <button
            type="button"
            aria-pressed={locale === "en"}
            onClick={() => setLocale("en")}
          >
            EN
          </button>
          <span>/</span>
          <button
            type="button"
            aria-pressed={locale === "vi"}
            onClick={() => setLocale("vi")}
          >
            VI
          </button>
        </div>
      </div>

      <div className="runway-content">
        <div className="runway-heading">
          <p className="eyebrow">{tr("YOUR EVERYDAY. REIMAGINED.")}</p>
          <h1>
            {tr("Find your")}
            <br />
            <em>{tr("main character.")}</em>
          </h1>
          <p>
            {tr(
              "Fresh silhouettes. Different moods. Step into the look that feels like you.",
            )}
          </p>

        </div>

        <div
          className="runway-stage"
          role="group"
          aria-label={tr("Circular fashion runway")}
          aria-busy={moving}
          data-moving={moving}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              selectLook(
                activeIndex + (event.key === "ArrowRight" ? 1 : -1),
                event.key === "ArrowRight" ? 1 : -1,
              );
            }
          }}
        >
          <div className="runway-orbit-floor" aria-hidden="true" />
          {featuredLooks.map((entry, index) => {
            const active = index === activeIndex;
            return (
              <div
                key={entry.id}
                ref={(node) => {
                  models.current[index] = node;
                }}
                className={`runway-model ${active ? "is-front" : "is-behind"}`}
                style={orbitStyle(index, rotation.current)}
                data-look={entry.id}
                data-active={active}
              >
                <div className="runway-photo">
                  <Image
                    src={entry.cutout ?? entry.image.replace(".png", "-cutout.png")}
                    alt={tr(entry.alt)}
                    fill
                    priority={index === 0}
                    sizes="(max-width: 767px) 72vw, 42vw"
                  />
                  {active ? (
                    <svg
                      className="runway-garment-map"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      role="group"
                      aria-label={tr("Explore the garments")}
                    >
                      {entry.products.map((product) => (
                        <TransitionLink
                          key={product.id}
                          href={runwayProductUrl(entry, product)}
                          className={`runway-garment ${inspectedId === product.id ? "is-inspected" : ""}`}
                          aria-label={tr("View {0}", { "0": tr(product.name) })}
                          aria-describedby={
                            inspectedId === product.id ? previewId : undefined
                          }
                          tabIndex={moving ? -1 : 0}
                          onPointerEnter={(event) => {
                            if (event.pointerType !== "touch")
                              inspect(product.id);
                          }}
                          onPointerLeave={dismissPreview}
                          onFocus={() => inspect(product.id)}
                          onBlur={dismissPreview}
                        >
                          {(garmentAreas[product.id] || []).map(
                            (points, part) => (
                              <polygon key={part} points={points} />
                            ),
                          )}
                        </TransitionLink>
                      ))}
                    </svg>
                  ) : (
                    <button
                      type="button"
                      className="runway-preview"
                      disabled={moving}
                      onClick={() => selectLook(index)}
                      aria-label={tr("View {0}", { "0": tr(entry.title) })}
                    />
                  )}
                </div>
              </div>
            );
          })}
          <button
            className="runway-arrow runway-arrow-previous"
            type="button"
            disabled={moving}
            onClick={() => selectLook(activeIndex - 1, -1)}
            aria-label={tr("Previous style")}
          >
            <ChevronLeft size={22} />
          </button>
          <button
            className="runway-arrow runway-arrow-next"
            type="button"
            disabled={moving}
            onClick={() => selectLook(activeIndex + 1, 1)}
            aria-label={tr("Next style")}
          >
            <ChevronRight size={22} />
          </button>
          <span className="runway-orbit-caption" aria-hidden="true">
            STYLE / IN MOTION
          </span>
        </div>

        <aside
          className="runway-inspector"
          aria-label={tr("Garment preview")}
          onPointerEnter={keepPreview}
          onPointerLeave={dismissPreview}
          onFocusCapture={keepPreview}
          onBlurCapture={dismissPreview}
        >
          {inspected ? (
            <div
              id={previewId}
              key={inspected.id}
              className="runway-preview-card"
              role="status"
              aria-atomic="true"
            >
              <p className="eyebrow">{tr("SELECTED PIECE")}</p>
              <div className="runway-preview-image">
                <Image
                  src={look.image}
                  alt={tr(inspected.name)}
                  fill
                  sizes="240px"
                  style={{
                    objectPosition: `${inspected.hotspot.x}% ${Math.max(0, Math.min(100, inspected.hotspot.y * 1.7 - 35))}%`,
                  }}
                />
              </div>
              <h2>{tr(inspected.name)}</h2>
              <div className="runway-preview-price">
                <strong>{money(inspected.price)}</strong>
                <span>{tr("Guide price")}</span>
              </div>
              <p>{tr(inspected.description)}</p>
              <div className="runway-preview-sizes">
                <span>{tr("Available sizes")}</span>
                <div>
                  {inspected.sizes.map((size) => (
                    <b key={size}>{size}</b>
                  ))}
                </div>
              </div>
              <TransitionLink
                className="runway-preview-detail"
                href={runwayProductUrl(look, inspected)}
              >
                {tr("View full details")}
                <ArrowUpRight size={15} />
              </TransitionLink>
            </div>
          ) : (
            <div className="runway-preview-empty">
              <Orbit size={28} />
              <p className="eyebrow">{tr("A CLOSER LOOK")}</p>
              <h2>{tr("Every piece has a story.")}</h2>
              <p>
                {tr(
                  "Move your cursor over the clothing or shoes to see the piece, sizes and price here.",
                )}
              </p>
              <span>{tr("Click the garment to see every detail.")}</span>
            </div>
          )}
        </aside>
      </div>

      <div className="runway-bottom">
        <div className="runway-current" aria-live="polite" aria-atomic="true">
          <span>
            {String(activeIndex + 1).padStart(2, "0")}
            <i>/ {String(featuredLooks.length).padStart(2, "0")}</i>
          </span>
          <div key={look.id}>
            <h2>{tr(look.title)}</h2>
            <p>{tr(look.subtitle)}</p>
          </div>
        </div>
        <div
          className="runway-dots"
          role="group"
          aria-label={tr("Choose a style")}
        >
          {featuredLooks.map((entry, index) => (
            <button
              key={entry.id}
              type="button"
              disabled={moving}
              onClick={() => selectLook(index)}
              aria-pressed={index === activeIndex}
              aria-label={tr("View {0}", { "0": tr(entry.title) })}
            />
          ))}
        </div>
      </div>
      <div className="runway-footnote">
        <span>{tr("LOOK FIRST. MAKE IT YOURS.")}</span>
        <Link href="/stylist">
          {tr("Find my look")}
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </section>
  );
}
