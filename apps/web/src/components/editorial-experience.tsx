"use client";
import { useI18n } from "@/components/locale-provider";
import Link from "next/link";
import { ArrowUpRight, Pause, Play, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { editorialLooks } from "@/lib/editorial";
/** Animate only at intersection. Content stays visible without JavaScript. */
export function Reveal({ children, className = "", delay = 0, }: {
    children: React.ReactNode;
    className?: string;
    delay?: number;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const node = ref.current;
        const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
        if (!node || preference.matches || !("IntersectionObserver" in window))
            return;
        let animation: Animation | undefined;
        const observer = new IntersectionObserver(([entry]) => {
            if (!entry.isIntersecting)
                return;
            if (!preference.matches) {
                animation = node.animate([
                    { opacity: 0, transform: "translateY(24px)" },
                    { opacity: 1, transform: "none" },
                ], {
                    duration: 700,
                    delay,
                    easing: "cubic-bezier(.2,.65,.3,1)",
                    fill: "backwards",
                });
            }
            observer.disconnect();
        }, { threshold: 0.08 });
        const stop = () => {
            if (preference.matches)
                animation?.cancel();
        };
        preference.addEventListener("change", stop);
        observer.observe(node);
        return () => {
            observer.disconnect();
            animation?.cancel();
            preference.removeEventListener("change", stop);
        };
    }, [delay]);
    return (<div ref={ref} className={className}>
      {children}
    </div>);
}
export function EditorialHero() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const [active, setActive] = useState(0);
    const look = editorialLooks[active];
    return (<div className="hero-visual photo-hero" aria-label={tr("C\u1EA3m h\u1EE9ng phong c\u00E1ch")}>
      {editorialLooks.map((entry, index) => (<img key={entry.image} className={`hero-photo ${active === index ? "is-active" : ""}`} src={entry.image} alt={tr(entry.alt)} aria-hidden={active !== index} width={900} height={1350} fetchPriority={index === 0 ? "high" : "auto"} loading={index === 0 ? "eager" : "lazy"}/>))}
      <span className="hero-photo-badge">
        <Sparkles size={13}/>{" " + tr("THE STYLE JOURNAL")}</span>
      <div className="vertical-caption">{tr("REAL LIFE. PERSONAL STYLE.")}</div>
      <div className="hero-photo-footer">
        <div className="hero-photo-controls">
          <div className="hero-photo-tabs" aria-label={tr("Ch\u1ECDn b\u1ED9 \u1EA3nh")}>
            {editorialLooks.map((entry, index) => (<button key={entry.name} aria-label={tr("Xem {0}", { "0": entry.name })} aria-pressed={active === index} onClick={() => setActive(index)}>
                <span>{String(index + 1).padStart(2, "0")}</span>
              </button>))}
          </div>
          <span className="photo-palette" aria-hidden="true">
            {look.colors.map((color) => (<i key={color} style={{ background: color }}/>))}
          </span>
        </div>
        <Link className="floating-tag" href={`/stylist?occasion=${look.occasion}`}>
          <span className="accent-dot"/>
          <div aria-live="polite">
            <strong>{look.name}</strong>
            <span>{look.subtitle}</span>
          </div>
          <ArrowUpRight size={23}/>
        </Link>
        <span className="visual-note">{tr("\u1EA2NH C\u1EA2M H\u1EE8NG \u00B7 KH\u00C1M PH\u00C1 PHONG C\u00C1CH C\u1EE6A B\u1EA0N")}</span>
      </div>
    </div>);
}
export function StyleMarquee() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const [paused, setPaused] = useState(false);
    return (<div className={`marquee ${paused ? "is-paused" : ""}`}>
      <div className="marquee-track">
        {[0, 1].map((copy) => (<div className="marquee-group" key={copy} aria-hidden={copy === 1}>
            <span>{tr("YOUR STYLE, YOUR RULES.")}</span>
            <span>✳</span>
            <span>{tr("THOUGHTFULLY PUT TOGETHER.")}</span>
            <span>✳</span>
            <span>{tr("A LITTLE MORE YOU.")}</span>
            <span>✳</span>
          </div>))}
      </div>
      <button className="marquee-toggle" onClick={() => setPaused(!paused)} aria-label={paused ? tr("Ti\u1EBFp t\u1EE5c ch\u1EEF ch\u1EA1y") : tr("T\u1EA1m d\u1EEBng ch\u1EEF ch\u1EA1y")}>
        {paused ? <Play size={14}/> : <Pause size={14}/>}
      </button>
    </div>);
}
