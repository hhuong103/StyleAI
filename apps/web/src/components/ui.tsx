"use client";
import { useI18n } from "@/components/locale-provider";
import Link from "next/link";
import { ArrowRight, Check, Menu, Search, Sparkles, UserRound, X, } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, clearSession } from "@/lib/api";
import { useToast, useUser } from "./providers";
export function Navigation() {
  const { tr, locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const user = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const client = useQueryClient();
  const toast = useToast();
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      clearSession();
      client.clear();
      setOpen(false);
      router.push("/");
    }
    catch (error) {
      toast(error instanceof Error ? error.message : tr("Ch\u01B0a th\u1EC3 \u0111\u0103ng xu\u1EA5t."));
    }
  }
  return (<header className="header">
    <div className="header-inner">
      <Link className="wordmark" href="/" aria-label={tr("STYLEAI Trang ch\u1EE7")}>
        STYLE<span>AI</span>
        <span className="wordmark-dot" />
      </Link>
      <nav className={`nav ${open ? "open" : ""}`} aria-label={tr("\u0110i\u1EC1u h\u01B0\u1EDBng ch\u00EDnh")}>
        {[
          ["/shop", tr("B\u1ED9 s\u01B0u t\u1EADp")],
          ["/looks", tr("The Looks")],
          ["/stylist", tr("AI Stylist")],
        ].map(([href, text]) => (<Link onClick={() => setOpen(false)} className={pathname.startsWith(href) ? "active" : ""} key={href} href={href}>
          {text}
          {href === "/stylist" && <Sparkles size={14} />}
        </Link>))}
        {user.data && (<>
          <Link href="/my-looks" onClick={() => setOpen(false)}>{tr("Look c\u1EE7a t\u00F4i")}</Link>
          <Link href="/history" onClick={() => setOpen(false)}>{tr("L\u1ECBch s\u1EED")}</Link>
          <button className="mobile-logout text-button" onClick={logout}>{tr("\u0110\u0103ng xu\u1EA5t")}</button>
        </>)}
        <div className="language-switch" role="group" aria-label="Language">
          <button type="button" aria-pressed={locale === "en"} onClick={() => setLocale("en")} aria-label="Switch language to English">EN</button>
          <button type="button" aria-pressed={locale === "vi"} onClick={() => setLocale("vi")} aria-label="Switch language to Vietnamese">VI</button>
        </div>
      </nav>
      <div className="header-tools">
        <Link className="icon-button desktop-tool" href="/shop" aria-label={tr("T\u00ECm s\u1EA3n ph\u1EA9m")}>
          <Search size={19} />
        </Link>
        {user.data ? (<>
          <Link className="profile-link" href="/profile" aria-label={tr("H\u1ED3 s\u01A1 c\u1EE7a t\u00F4i")}>
            <UserRound size={18} />
            <span>{user.data.display_name.split(" ").pop()}</span>
          </Link>
          {user.data.role === "ADMIN" && (<Link className="small-link" href="/admin">{tr("Admin")}</Link>)}
          <button className="small-link desktop-tool" onClick={logout}>{tr("Tho\u00E1t")}</button>
        </>) : (<Link className="button small outline" href="/login">{tr("\u0110\u0103ng nh\u1EADp") + " "}<ArrowRight size={14} />
        </Link>)}
        <button className="icon-button mobile-menu" aria-label={open ? tr("\u0110\u00F3ng menu") : tr("M\u1EDF menu")} aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </div>
  </header>);
}
export function Footer() {
  const { tr, label, money, productName, localeTag } = useI18n();
  return (<footer className="footer">
    <div className="container footer-inner">
      <Link className="wordmark" href="/">
        STYLE<span>AI</span>
      </Link>
      <p>{tr("Phong c\u00E1ch c\u1EE7a b\u1EA1n. Theo c\u00E1ch c\u1EE7a b\u1EA1n.")}</p>
    </div>
  </footer>);
}
export function PageIntro({ eyebrow, title, description, action, }: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const { tr, label, money, productName, localeTag } = useI18n();
  return (<div className="page-intro">
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {description && <p className="intro-copy">{description}</p>}
    </div>
    {action}
  </div>);
}
export function ErrorBox({ error, retry, }: {
  error: unknown;
  retry?: () => void;
}) {
  const { tr, label, money, productName, localeTag } = useI18n();
  if (!error)
    return null;
  return (<div role="alert" className="error-box">
    {error instanceof Error ? error.message : tr("C\u00F3 l\u1ED7i x\u1EA3y ra.")}
    {retry && (<button className="text-button" onClick={retry}>{tr("Th\u1EED l\u1EA1i") + " "}<ArrowRight size={14} />
    </button>)}
  </div>);
}
export function Empty({ title, description, href = "/stylist", cta = "Bắt đầu phối đồ", }: {
  title: string;
  description: string;
  href?: string;
  cta?: string;
}) {
  const { tr, label, money, productName, localeTag } = useI18n();
  return (<div className="empty-state">
    <Sparkles size={30} />
    <h2>{title}</h2>
    <p>{description}</p>
    <Link className="button" href={href}>
      {cta}
      <ArrowRight size={16} />
    </Link>
  </div>);
}
export function Skeletons({ count = 3 }: {
  count?: number;
}) {
  const { tr, label, money, productName, localeTag } = useI18n();
  return (<div className="product-grid" aria-busy="true" aria-label={tr("\u0110ang t\u1EA3i")}>
    {Array.from({ length: count }, (_, i) => (<div key={i}>
      <div className="skeleton tall" />
      <div className="skeleton line" />
      <div className="skeleton short" />
    </div>))}
  </div>);
}
export function CheckLine({ children }: {
  children: React.ReactNode;
}) {
  const { tr, label, money, productName, localeTag } = useI18n();
  return (<span className="check-line">
    <Check size={15} />
    {children}
  </span>);
}
