"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createFormatter, LOCALE_COOKIE, normalizeLocale, type Locale } from "@/lib/i18n/locale";

const LocaleContext = createContext({
  ...createFormatter("en"),
  setLocale: (_locale: Locale) => {},
});

export function LocaleProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const [locale, updateLocale] = useState(initialLocale);
  const setLocale = useCallback((value: Locale) => {
    const next = normalizeLocale(value);
    document.cookie = `${LOCALE_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = next;
    updateLocale(next);
  }, []);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo(() => ({ ...createFormatter(locale), setLocale }), [locale, setLocale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useI18n = () => useContext(LocaleContext);

export function SkipLink() {
  const { tr } = useI18n();
  return <a href="#main" className="skip-link">{tr("Đi đến nội dung")}</a>;
}
