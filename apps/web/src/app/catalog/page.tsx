"use client";

import { Suspense } from "react";
import { CatalogScreen } from "@/components/catalog-screen";
import { useI18n } from "@/components/locale-provider";

export default function CatalogPage() {
  const { tr } = useI18n();
  return (
    <Suspense
      fallback={<div className="container page">{tr("Đang tải…")}</div>}
    >
      <CatalogScreen />
    </Suspense>
  );
}
