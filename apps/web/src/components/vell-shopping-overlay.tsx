"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { safeShoppingUrl, type ShoppingTarget } from "@/lib/vell-shopping";

export function VellShoppingOverlay({
  targets,
  width,
  height,
  onExpired,
}: {
  targets: ShoppingTarget[];
  width: number;
  height: number;
  onExpired: () => void;
}) {
  const tooltipId = useId();
  const [hovered, setHovered] = useState<{
    target: ShoppingTarget;
    x: number;
    y: number;
  } | null>(null);
  const valid = targets.filter(
    (target) =>
      safeShoppingUrl(target.url) &&
      (!target.validUntil || Date.parse(target.validUntil) > Date.now()),
  );
  const show = (target: ShoppingTarget, element: Element) => {
    const rect = element.getBoundingClientRect();
    setHovered({
      target,
      x: Math.max(12, Math.min(window.innerWidth - 272, rect.right + 12)),
      y: Math.max(12, Math.min(window.innerHeight - 160, rect.top)),
    });
  };
  if (!valid.length) return null;
  return (
    <>
      <svg
        className="vell-regions vell-shopping-regions"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMax meet"
        aria-label="Mua sắm trên trang phục"
      >
        {valid.map((target) => (
          <a
            key={target.id}
            href={target.url}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={0}
            aria-label={`${target.match === "SIMILAR" ? "Xem sản phẩm tương tự" : "Mua"}: ${target.name} · ${target.retailer} (tab mới)`}
            aria-describedby={
              hovered?.target.id === target.id ? tooltipId : undefined
            }
            onPointerEnter={(event) => show(target, event.currentTarget)}
            onPointerLeave={() => setHovered(null)}
            onFocus={(event) => show(target, event.currentTarget)}
            onBlur={() => setHovered(null)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setHovered(null);
            }}
            onClick={(event) => {
              if (
                target.validUntil &&
                Date.parse(target.validUntil) <= Date.now()
              ) {
                event.preventDefault();
                setHovered(null);
                onExpired();
                return;
              }
            }}
          >
            {target.polygons.map((polygon, i) => (
              <polygon
                key={i}
                vectorEffect="non-scaling-stroke"
                points={polygon
                  .map(([x, y]) => `${x * width},${y * height}`)
                  .join(" ")}
              />
            ))}
            <circle
              className="vell-shopping-ring"
              cx={target.marker[0] * width}
              cy={target.marker[1] * height}
              r={width * 0.024}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              className="vell-shopping-dot"
              cx={target.marker[0] * width}
              cy={target.marker[1] * height}
              r={width * 0.006}
            />
          </a>
        ))}
      </svg>
      {hovered &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            className="vell-shopping-tooltip"
            style={{ left: hovered.x, top: hovered.y }}
          >
            <span>
              {hovered.target.match === "SIMILAR" ? "TƯƠNG TỰ" : "ĐÃ XÁC MINH"}{" "}
              · {hovered.target.retailer}
            </span>
            <strong>{hovered.target.name}</strong>
            {hovered.target.market && (
              <small>
                Cửa hàng {hovered.target.market} · Kiểm tra size & giao hàng
              </small>
            )}
            <b>Xem tại {hovered.target.retailer} ↗</b>
          </div>,
          document.body,
        )}
    </>
  );
}
