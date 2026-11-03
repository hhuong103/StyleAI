import english from "./en.json";
import vietnamese from "./vi.json";
import { labels } from "../format";

export type Locale = "en" | "vi";
export const LOCALE_COOKIE = "styleai_locale";
export const normalizeLocale = (value: unknown): Locale => value === "vi" ? "vi" : "en";
export const localeTag = (locale: Locale) => locale === "vi" ? "vi-VN" : "en-US";

const en: Record<string, string> = english;
const vi: Record<string, string> = {
  ...Object.fromEntries(Object.entries(en).map(([source, translation]) => [translation, source])),
  ...vietnamese,
};

export function translate(locale: Locale, source: string, values: Record<string, string | number> = {}) {
  const message = (locale === "en" ? en[source] : vi[source]) ?? source;
  return message.replace(/\{(\w+)\}/g, (token, key: string) => String(values[key] ?? token));
}

export function createFormatter(locale: Locale) {
  const tr = (source: string, values?: Record<string, string | number>) => translate(locale, source, values);
  const label = (code: string, fallback?: string) => tr(labels[code] || fallback || code.replaceAll("_", " "));
  const money = (value: number) => new Intl.NumberFormat(localeTag(locale), {
    style: "currency", currency: "VND", maximumFractionDigits: 0,
  }).format(value);
  const productName = (product: { name: string; product_code?: string }) => {
    const parts = product.product_code?.match(/^DEMO_(.+)_([A-Z]+)_(\d+)$/);
    if (locale === "vi" || !parts) return product.name;
    const [, category, color, edition] = parts;
    const original = `${labels[category]} ${labels[color]?.toLowerCase()} — Edit ${edition}`;
    // Only translate untouched synthetic names. Preserve merchant and user content.
    return product.name === original ? `${label(category)} · ${label(color)} — Edit ${edition}` : product.name;
  };
  return { tr, label, money, productName, locale, localeTag: localeTag(locale) };
}
