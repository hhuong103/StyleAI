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
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useI18n } from "@/components/locale-provider";
import { TransitionLink } from "@/components/route-transition";
import {
  featuredLooks,
  garmentAreas,
  garmentOutlineAreas,
  garmentPreviewAreas,
  runwayProductUrl,
} from "@/lib/runway";

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

function garmentPreviewGeometry(productId: string) {
  const source =
    garmentPreviewAreas[productId] ?? garmentAreas[productId] ?? [];
  const polygons = source.map((shape) =>
    shape
      .trim()
      .split(/\s+/)
      .map((pair) => {
        const [x, y] = pair.split(",").map(Number);
        return { x, y: y * 1.5 };
      }),
  );
  const points = polygons.flat();
  if (!points.length) return null;

  const minX = Math.max(0, Math.min(...points.map((point) => point.x)) - 4);
  const maxX = Math.min(100, Math.max(...points.map((point) => point.x)) + 4);
  const minY = Math.max(0, Math.min(...points.map((point) => point.y)) - 6);
  const maxY = Math.min(150, Math.max(...points.map((point) => point.y)) + 6);

  return {
    viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    polygons: polygons.map((polygon) =>
      polygon.map((point) => `${point.x},${point.y}`).join(" "),
    ),
  };
}

export function ShopTheLook() {
  const { tr, money, locale, setLocale } = useI18n();
  const [activeIndex, setActiveIndex] = useState(0);
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const models = useRef<(HTMLDivElement | null)[]>([]);
  const activeIndexRef = useRef(0);
  const rotation = useRef(0);
  const targetRotation = useRef(0);
  const angularVelocity = useRef(0);
  const lastFrame = useRef(0);
  const frame = useRef<number | null>(null);
  const drag = useRef<{
    pointerId: number;
    startX: number;
    startRotation: number;
    lastX: number;
    lastTime: number;
    velocity: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);
  const dismiss = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewId = useId();
  const stageHintId = useId();
  const look = featuredLooks[activeIndex];
  const inspected = look.products.find((product) => product.id === inspectedId);
  const previewProductImage = inspected?.packshot ?? inspected?.thumbnail;
  const previewGeometry =
    inspected && !previewProductImage
      ? garmentPreviewGeometry(inspected.id)
      : null;
  const garmentClipId = inspected
    ? `${previewId.replaceAll(":", "")}-${inspected.id}`
    : "";

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
      targetRotation.current = rotation.current;
      activeIndexRef.current = index;
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
    if (!drag.current?.moved) setInspectedId(id);
  }

  function dismissPreview() {
    keepPreview();
    dismiss.current = setTimeout(() => setInspectedId(null), 320);
  }

  function animateTo(target: number, initialVelocity?: number) {
    targetRotation.current = target;
    if (initialVelocity !== undefined)
      angularVelocity.current = initialVelocity;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      rotation.current = target;
      angularVelocity.current = 0;
      setMoving(false);
      paintOrbit(target);
      return;
    }

    setMoving(true);
    if (frame.current !== null) return;
    lastFrame.current = performance.now();

    function animate(now: number) {
      const elapsed = Math.min((now - lastFrame.current) / 1000, 1 / 30);
      lastFrame.current = now;

      // Critically damped spring: response ≈ 0.42s, no decorative bounce.
      const omega = (2 * Math.PI) / 0.42;
      const displacement = rotation.current - targetRotation.current;
      const acceleration =
        -(omega * omega) * displacement - 2 * omega * angularVelocity.current;
      angularVelocity.current += acceleration * elapsed;
      rotation.current += angularVelocity.current * elapsed;
      paintOrbit(rotation.current);

      const settled =
        Math.abs(rotation.current - targetRotation.current) < 0.0005 &&
        Math.abs(angularVelocity.current) < 0.002;
      if (settled) {
        rotation.current = targetRotation.current;
        angularVelocity.current = 0;
        frame.current = null;
        paintOrbit(rotation.current);
        setMoving(false);
      } else {
        frame.current = requestAnimationFrame(animate);
      }
    }

    frame.current = requestAnimationFrame(animate);
  }

  function selectLook(index: number, forcedDirection?: number) {
    const next = (index + featuredLooks.length) % featuredLooks.length;
    const current = activeIndexRef.current;
    if (next === current && forcedDirection === undefined) return;
    let distance = forcedDirection ?? next - current;
    if (distance > featuredLooks.length / 2) distance -= featuredLooks.length;
    if (distance < -featuredLooks.length / 2) distance += featuredLooks.length;
    const target = targetRotation.current - distance * STEP;
    keepPreview();
    setInspectedId(null);
    activeIndexRef.current = next;
    setActiveIndex(next);
    sessionStorage.setItem("styleai-runway-look", featuredLooks[next].id);
    animateTo(target);
  }

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      (event.target as Element).closest(
        ".runway-arrow, .runway-garment, .runway-preview-card",
      )
    )
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startRotation: rotation.current,
      lastX: event.clientX,
      lastTime: performance.now(),
      velocity: 0,
      moved: false,
    };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const distance = event.clientX - gesture.startX;
    if (!gesture.moved && Math.abs(distance) < 10) return;
    if (!gesture.moved) {
      gesture.moved = true;
      suppressClick.current = true;
      keepPreview();
      setInspectedId(null);
      setDragging(true);
      setMoving(true);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    }

    const now = performance.now();
    const elapsed = Math.max(now - gesture.lastTime, 1);
    const instantVelocity = ((event.clientX - gesture.lastX) / elapsed) * 1000;
    gesture.velocity = gesture.velocity * 0.65 + instantVelocity * 0.35;
    gesture.lastX = event.clientX;
    gesture.lastTime = now;

    const width = Math.max(event.currentTarget.clientWidth, 1);
    rotation.current = gesture.startRotation + (distance / width) * STEP * 1.65;
    targetRotation.current = rotation.current;
    angularVelocity.current = (gesture.velocity / width) * STEP * 1.65;
    paintOrbit(rotation.current);
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (!gesture.moved) return;

    const width = Math.max(event.currentTarget.clientWidth, 1);
    const projectedPixels = ((gesture.velocity / 1000) * 0.99) / (1 - 0.99);
    const projectedRotation =
      rotation.current + (projectedPixels / width) * STEP * 1.65;
    const rawIndex = Math.round(-projectedRotation / STEP);
    const next =
      ((rawIndex % featuredLooks.length) + featuredLooks.length) %
      featuredLooks.length;
    const target = -rawIndex * STEP;
    activeIndexRef.current = next;
    setActiveIndex(next);
    setInspectedId(null);
    sessionStorage.setItem("styleai-runway-look", featuredLooks[next].id);
    animateTo(target, angularVelocity.current);
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
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
          aria-describedby={stageHintId}
          aria-busy={moving}
          data-moving={moving}
          data-dragging={dragging}
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
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
                    src={
                      entry.cutout ?? entry.image.replace(".png", "-cutout.png")
                    }
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
                          tabIndex={0}
                          onPointerEnter={(event) => {
                            if (event.pointerType !== "touch")
                              inspect(product.id);
                          }}
                          onPointerLeave={dismissPreview}
                          onFocus={() => inspect(product.id)}
                          onBlur={dismissPreview}
                        >
                          <g className="runway-garment-hit" aria-hidden="true">
                            {(garmentAreas[product.id] || []).map(
                              (points, part) => (
                                <polygon key={part} points={points} />
                              ),
                            )}
                          </g>
                          <g
                            className="runway-garment-outline"
                            aria-hidden="true"
                          >
                            {(
                              garmentOutlineAreas[product.id] ||
                              garmentAreas[product.id] ||
                              []
                            ).map((points, part) => (
                              <polygon key={part} points={points} />
                            ))}
                          </g>
                        </TransitionLink>
                      ))}
                    </svg>
                  ) : (
                    <button
                      type="button"
                      className="runway-preview"
                      onClick={(event) => {
                        if (suppressClick.current) {
                          event.preventDefault();
                          suppressClick.current = false;
                          return;
                        }
                        selectLook(index);
                      }}
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
            onClick={() => selectLook(activeIndexRef.current - 1, -1)}
            aria-label={tr("Previous style")}
          >
            <ChevronLeft size={22} />
          </button>
          <button
            className="runway-arrow runway-arrow-next"
            type="button"
            onClick={() => selectLook(activeIndexRef.current + 1, 1)}
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
                {previewProductImage && (
                  <Image
                    className="runway-preview-packshot"
                    src={previewProductImage}
                    alt={tr(inspected.name)}
                    fill
                    sizes="(max-width: 767px) 88vw, 32vw"
                  />
                )}
                {previewGeometry && (
                  <svg
                    viewBox={previewGeometry.viewBox}
                    preserveAspectRatio="xMidYMid meet"
                    role="img"
                    aria-label={tr(inspected.name)}
                  >
                    <defs>
                      <clipPath
                        id={garmentClipId}
                        clipPathUnits="userSpaceOnUse"
                      >
                        {previewGeometry.polygons.map((points, index) => (
                          <polygon key={index} points={points} />
                        ))}
                      </clipPath>
                    </defs>
                    <image
                      href={look.image}
                      x="0"
                      y="0"
                      width="100"
                      height="150"
                      preserveAspectRatio="none"
                      clipPath={`url(#${garmentClipId})`}
                    />
                  </svg>
                )}
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
