"use client";
import { useI18n } from "@/components/locale-provider";
import { Suspense } from "react";
import { CatalogScreen } from "@/components/catalog-screen";
export default function Page() {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<Suspense fallback={<div className="container page">{tr("\u0110ang t\u1EA3i\u2026")}</div>}>
      <CatalogScreen />
    </Suspense>);
}
