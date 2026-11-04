import type { Metadata } from "next";
import { cookies } from "next/headers";
import { LocaleProvider, SkipLink } from "@/components/locale-provider";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/locale";
import { Providers } from "@/components/providers";
import { Footer, Navigation } from "@/components/ui";
import { RouteTransition } from "@/components/route-transition";
import "./globals.css";
import "./fonts.css";
import "./runway.css";
export const metadata: Metadata = {
  title: {
    default: "STYLEAI — Your style, thoughtfully put together.",
    template: "%s | STYLEAI",
  },
  description:
    "Personal outfit recommendations for your style, occasion, and budget.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider initialLocale={locale}>
          <Providers>
            <SkipLink />
            <Navigation />
            <main id="main">
              <RouteTransition>{children}</RouteTransition>
            </main>
            <Footer />
          </Providers>
        </LocaleProvider>
      </body>
    </html>
  );
}
