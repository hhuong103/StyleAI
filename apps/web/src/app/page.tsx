"use client";
import { useI18n } from "@/components/locale-provider";
import Link from "next/link";
import { editorialLooks } from "@/lib/editorial";
import { EditorialHero, Reveal, StyleMarquee, } from "@/components/editorial-experience";
import { ArrowDownRight, ArrowRight, ScanLine, SlidersHorizontal, Sparkles, } from "lucide-react";
export default function Home() {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<>
      <section className="hero container">
        <Reveal className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot"/>{" " + tr("YOUR PERSONAL AI STYLIST")}</p>
          <h1>{tr("Good style.")}<br />
            <em>{tr("Made yours.")}</em>
          </h1>
          <p className="hero-description">{tr("M\u1ED9t cu\u1ED9c h\u1EB9n, m\u1ED9t ng\u00E0y m\u1EDBi, m\u1ED9t phi\u00EAn b\u1EA3n kh\u00E1c c\u1EE7a b\u1EA1n. T\u00ECm c\u1EA3 b\u1ED9 trang ph\u1EE5c h\u1EE3p phong c\u00E1ch v\u00E0 v\u1EEBa ng\u00E2n s\u00E1ch.")}</p>
          <Link className="button" href="/stylist">{tr("Kh\u00E1m ph\u00E1 phong c\u00E1ch c\u1EE7a b\u1EA1n") + " "}<ArrowRight size={18}/>
          </Link>
          <div className="hero-caption">
            <span>{tr("01 \u2014 DESCRIBE. DISCOVER. MAKE IT YOURS.")}</span>
            <ArrowDownRight size={20}/>
          </div>
        </Reveal>
        <EditorialHero />
      </section>
      <StyleMarquee />
      <section className="container section">
        <Reveal className="section-heading">
          <div>
            <p className="eyebrow">{tr("THE LOOK, NOT JUST THE PIECES")}</p>
            <h2>{tr("M\u1ED9t b\u1ED9 \u0111\u1ED3.")}<br />
              <em>{tr("Nhi\u1EC1u kh\u1EA3 n\u0103ng.")}</em>
            </h2>
          </div>
          <p>{tr("Thay v\u00EC t\u00ECm t\u1EEBng m\u00F3n, h\u00E3y b\u1EAFt \u0111\u1EA7u v\u1EDBi m\u1ED9t Look ho\u00E0n ch\u1EC9nh. Xem l\u00FD do ph\u00F9 h\u1EE3p, thay m\u1ED9t chi ti\u1EBFt v\u00E0 bi\u1EBFn n\u00F3 th\u00E0nh c\u1EE7a ri\u00EAng b\u1EA1n.")}</p>
        </Reveal>
        <div className="editorial-grid">
          {editorialLooks.map((look, i) => (<Reveal key={look.name} delay={i * 90}>
              <Link href={`/stylist?occasion=${look.occasion}`} className="editorial-tile photographic-tile">
                <span className="eyebrow">{look.label}</span>
                <img src={look.image} alt={tr(look.alt)} loading="lazy" width={900} height={1350}/>
                <div>
                  <h3>{look.name}</h3>
                  <p>{tr(look.description)}</p>
                </div>
                <span className="circle-arrow">
                  <ArrowRight size={20}/>
                </span>
              </Link>
            </Reveal>))}
        </div>
      </section>
      <section className="how-section">
        <div className="container">
          <p className="eyebrow">{tr("A LITTLE INPUT. A WHOLE NEW LOOK.")}</p>
          <div className="section-heading">
            <h2>{tr("Ph\u1ED1i \u0111\u1ED3,") + " "}<em>{tr("\u0111\u01A1n gi\u1EA3n h\u01A1n.")}</em>
            </h2>
            <Link className="text-button" href="/stylist">{tr("Th\u1EED AI Stylist") + " "}<ArrowRight size={18}/>
            </Link>
          </div>
          <div className="steps">
            {[
            {
                icon: Sparkles,
                n: "01",
                title: tr("K\u1EC3 ch\u00FAng t\u00F4i nghe"),
                text: tr("B\u1EA1n s\u1EBD \u0111i \u0111\u00E2u? Th\u00EDch phong c\u00E1ch n\u00E0o? Ng\u00E2n s\u00E1ch bao nhi\u00EAu?"),
            },
            {
                icon: ScanLine,
                n: "02",
                title: tr("Kh\u00E1m ph\u00E1 Look c\u1EE7a b\u1EA1n"),
                text: tr("Nh\u1EADn nh\u1EEFng b\u1ED9 trang ph\u1EE5c t\u1EEB catalog, c\u00F3 gi\u00E1 v\u00E0 l\u00FD do ph\u00F9 h\u1EE3p r\u00F5 r\u00E0ng."),
            },
            {
                icon: SlidersHorizontal,
                n: "03",
                title: tr("Th\u00EAm d\u1EA5u \u1EA5n ri\u00EAng"),
                text: tr("Thay m\u00F3n, ch\u1ECDn bi\u1EBFn th\u1EC3, l\u01B0u Look y\u00EAu th\u00EDch v\u00E0 g\u1EEDi ph\u1EA3n h\u1ED3i."),
            },
        ].map((step) => (<Reveal key={step.n} delay={Number(step.n) * 70}>
                <article>
                  <div className="step-top">
                    <step.icon size={26}/>
                    <span>{step.n}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </article>
              </Reveal>))}
          </div>
        </div>
      </section>
      <section className="container closing">
        <Reveal>
          <p className="eyebrow">{tr("LESS GUESSING. MORE YOU.")}</p>
          <h2>{tr("Your next look")}<br />{tr("starts") + " "}<em>{tr("with you.")}</em>
          </h2>
          <Link className="button accent" href="/stylist">{tr("B\u1EAFt \u0111\u1EA7u ph\u1ED1i \u0111\u1ED3") + " "}<ArrowRight size={18}/>
          </Link>
        </Reveal>
      </section>
    </>);
}
