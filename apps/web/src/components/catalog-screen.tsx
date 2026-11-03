"use client";
import { useI18n } from "@/components/locale-provider";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Product, Taxonomy } from "@/lib/types";
import { useUser } from "./providers";
import { Empty, ErrorBox, PageIntro, Skeletons } from "./ui";
export function ProductCard({ product }: {
    product: Product;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<Link className="product-card" href={`/shop/${product.id}`}>
      <div className="product-image">
        <img src={product.image?.url || "/editorial.svg"} alt={product.image?.alt_text || product.name} loading="lazy"/>
        {!product.available && <span className="stock-badge">{tr("H\u1EBFt h\u00E0ng")}</span>}
        <span className="product-quick">
          <ArrowRight size={20}/>
        </span>
      </div>
      <div className="product-meta">
        <h3>{product.name}</h3>
        <span>{money(product.price_vnd)}</span>
      </div>
      <p>
        {product.brand} <span>·</span>{" "}
        {product.price_source === "DEMO"
            ? tr("Gi\u00E1 m\u00F4 ph\u1ECFng") : label(product.styles[0] || "")}
      </p>
    </Link>);
}
export function CatalogScreen() {
    const { tr, label, money, productName, localeTag } = useI18n();
    return <Catalog />;
}
function Catalog() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const params = useSearchParams();
    const router = useRouter();
    const qs = params.toString();
    const products = useQuery({
        queryKey: [user.data?.id, "products", qs],
        queryFn: () => api<Product[]>(`/products?${qs}`),
    });
    const taxonomy = useQuery({
        queryKey: [user.data?.id, "taxonomy"],
        queryFn: () => api<Taxonomy>("/taxonomy").then((r) => r.data),
    });
    function filter(key: string, value: string) {
        const next = new URLSearchParams(qs);
        if (value)
            next.set(key, value);
        else
            next.delete(key);
        if (key !== "page")
            next.delete("page");
        router.replace(`/shop?${next}`);
    }
    const page = Number(params.get("page") || 1), total = products.data?.meta.total || 0;
    return (<div className="container page">
      <PageIntro eyebrow={tr("THE CONSIDERED COLLECTION")} title={tr("Ch\u1ECDn \u00EDt h\u01A1n. H\u1EE3p h\u01A1n.")} description={tr("Nh\u1EEFng m\u00F3n \u0111\u1ED3 \u0111\u1EC3 b\u1EA1n x\u00E2y d\u1EF1ng phong c\u00E1ch ri\u00EAng. Catalog v\u00E0 gi\u00E1 DEMO \u0111\u01B0\u1EE3c \u0111\u00E1nh d\u1EA5u r\u00F5.")}/>
      <div className="shop-layout">
        <aside className="filters">
          <form className="search-field" onSubmit={(e) => {
            e.preventDefault();
            filter("q", new FormData(e.currentTarget).get("q") as string);
        }}>
            <input name="q" aria-label={tr("T\u00ECm ki\u1EBFm s\u1EA3n ph\u1EA9m")} placeholder={tr("T\u00ECm m\u1ED9t m\u00F3n \u0111\u1ED3\u2026")} defaultValue={params.get("q") || ""}/>
            <button className="icon-button" aria-label={tr("T\u00ECm")}>
              <Search size={18}/>
            </button>
          </form>
          {([
            ["category", tr("Lo\u1EA1i trang ph\u1EE5c"), "categories"],
            ["styles", tr("Phong c\u00E1ch"), "styles"],
            ["occasions", tr("Ho\u00E0n c\u1EA3nh"), "occasions"],
            ["color", tr("M\u00E0u s\u1EAFc"), "colors"],
        ] as const).map(([key, title, group]) => (<label key={key}>
              {title}
              <select value={params.get(key) || ""} onChange={(e) => filter(key, e.target.value)}>
                <option value="">{tr("T\u1EA5t c\u1EA3")}</option>
                {taxonomy.data?.[group].map((t) => (<option key={t.code} value={t.code}>
                    {t.label}
                  </option>))}
              </select>
            </label>))}
          <label>{tr("Gender")}<select value={params.get("gender") || ""} onChange={(e) => filter("gender", e.target.value)}>
              <option value="">{tr("T\u1EA5t c\u1EA3")}</option>
              <option value="FEMALE">{tr("N\u1EEF")}</option>
              <option value="MALE">{tr("Nam")}</option>
              <option value="UNISEX">{tr("Unisex")}</option>
            </select>
          </label>
          <label>{tr("Gi\u00E1 t\u1EEB (VND)")}<input type="number" min="0" value={params.get("min_price_vnd") || ""} onChange={(e) => filter("min_price_vnd", e.target.value)}/>
          </label>
          <label>{tr("Gi\u00E1 \u0111\u1EBFn (VND)")}<input type="number" min="0" value={params.get("max_price_vnd") || ""} onChange={(e) => filter("max_price_vnd", e.target.value)}/>
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={params.get("available") === "true"} onChange={(e) => filter("available", e.target.checked ? "true" : "")}/>{tr("Ch\u1EC9 s\u1EA3n ph\u1EA9m c\u00F2n h\u00E0ng")}</label>
          <button className="text-button" onClick={() => router.replace("/shop")}>{tr("X\u00F3a b\u1ED9 l\u1ECDc") + " "}<X size={15}/>
          </button>
        </aside>
        <section>
          <div className="catalog-toolbar">
            <span>{total.toLocaleString("vi-VN")}{" " + tr("s\u1EA3n ph\u1EA9m")}</span>
            <select aria-label={tr("S\u1EAFp x\u1EBFp")} value={params.get("sort") || "newest"} onChange={(e) => filter("sort", e.target.value)}>
              <option value="newest">{tr("M\u1EDBi nh\u1EA5t")}</option>
              <option value="price_asc">{tr("Gi\u00E1 t\u0103ng d\u1EA7n")}</option>
              <option value="price_desc">{tr("Gi\u00E1 gi\u1EA3m d\u1EA7n")}</option>
              <option value="name_asc">{tr("T\u00EAn A\u2013Z")}</option>
            </select>
          </div>
          <ErrorBox error={products.error} retry={() => products.refetch()}/>
          {products.isPending ? (<Skeletons />) : products.data?.data.length ? (<div className="product-grid">
              {products.data.data.map((p) => (<ProductCard key={p.id} product={p}/>))}
            </div>) : (!products.error && (<Empty title={tr("Ch\u01B0a t\u00ECm \u0111\u01B0\u1EE3c m\u00F3n ph\u00F9 h\u1EE3p")} description={tr("Th\u1EED thay \u0111\u1ED5i ho\u1EB7c x\u00F3a m\u1ED9t v\u00E0i b\u1ED9 l\u1ECDc.")} href="/shop" cta={tr("Xem t\u1EA5t c\u1EA3")}/>))}
          <div className="pagination">
            <button className="button outline small" disabled={page <= 1} onClick={() => filter("page", String(page - 1))}>
              <ArrowLeft size={16}/>{tr("Tr\u01B0\u1EDBc")}</button>
            <span>{tr("Trang") + " "}{page}</span>
            <button className="button outline small" disabled={page * 24 >= total} onClick={() => filter("page", String(page + 1))}>{tr("Sau") + " "}<ArrowRight size={16}/>
            </button>
          </div>
        </section>
      </div>
    </div>);
}
export function Modal({ title, children, onClose, }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current;
        const previous = document.activeElement as HTMLElement;
        dialog?.showModal();
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            dialog?.close();
            document.body.style.overflow = overflow;
            previous?.focus();
        };
    }, []);
    return (<dialog ref={ref} className="modal" onCancel={(e) => {
            e.preventDefault();
            onClose();
        }} onClick={(e) => {
            if (e.target === e.currentTarget)
                onClose();
        }} aria-label={title}>
      <div className="modal-header">
        <h2>{title}</h2>
        <button className="icon-button" aria-label={tr("\u0110\u00F3ng")} onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>);
}
export function ProductContent({ product, selectedVariant, onVariant, }: {
    product: Product;
    selectedVariant?: string;
    onVariant?: (id: string) => void;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    const [variant, setVariant] = useState(selectedVariant || product.variants.find((v) => v.available)?.id || "");
    const selected = product.variants.find((v) => v.id === variant);
    return (<div className="product-detail">
      <img className="detail-image" src={product.image?.url || "/editorial.svg"} alt={product.image?.alt_text || product.name}/>
      <div>
        <p className="eyebrow">{product.brand}</p>
        <h2>{product.name}</h2>
        <p className="detail-price">
          {money(selected?.price_vnd ?? product.price_vnd)}
        </p>
        {product.price_source === "DEMO" && (<p className="demo-note">{tr("S\u1EA3n ph\u1EA9m v\u00E0 gi\u00E1 m\u00F4 ph\u1ECFng. H\u00ECnh \u1EA3nh d\u00F9ng \u0111\u1EC3 tham kh\u1EA3o. Kh\u00F4ng c\u00F3 thanh to\u00E1n.")}</p>)}
        <p>{product.description}</p>
        <div className="tag-list">
          {product.styles.map((s) => (<span key={s}>{label(s)}</span>))}
        </div>
        <label>{tr("Bi\u1EBFn th\u1EC3 / size")}<select value={variant} onChange={(e) => setVariant(e.target.value)}>
            {product.variants.map((v) => (<option key={v.id} value={v.id} disabled={!v.available}>
                {v.size_code === "ONE_SIZE"
                ? tr("Th\u00F4ng tin size ch\u01B0a c\u00F3") : v.size_code}{" "}
                — {money(v.price_vnd)}
                {!v.available ? tr(" \u00B7 H\u1EBFt h\u00E0ng") : ""}
              </option>))}
          </select>
        </label>
        {onVariant ? (<button className="button full" disabled={!selected?.available || variant === selectedVariant} onClick={() => onVariant(variant)}>{tr("Ch\u1ECDn bi\u1EBFn th\u1EC3 n\u00E0y") + " "}<ArrowRight size={16}/>
          </button>) : (<Link className="button" href="/stylist">{tr("Ph\u1ED1i Look v\u1EDBi AI Stylist") + " "}<ArrowRight size={16}/>
          </Link>)}
      </div>
    </div>);
}
export function ProductDrawer({ productId, selectedVariant, onVariant, onClose, error, }: {
    productId: string;
    error?: unknown;
    selectedVariant?: string;
    onVariant?: (id: string) => void;
    onClose: () => void;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const product = useQuery({
        queryKey: [user.data?.id, "product", productId],
        queryFn: () => api<Product>(`/products/${productId}`).then((r) => r.data),
    });
    return (<Modal title={tr("Chi ti\u1EBFt s\u1EA3n ph\u1EA9m")} onClose={onClose}>
      <ErrorBox error={product.error || error}/>
      {product.data ? (<ProductContent product={product.data} selectedVariant={selectedVariant} onVariant={onVariant}/>) : (<Skeletons count={1}/>)}
    </Modal>);
}
export function ProductScreen() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const { productId } = useParams<{
        productId: string;
    }>();
    return <ProductPage id={productId}/>;
}
function ProductPage({ id }: {
    id: string;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const query = useQuery({
        queryKey: [user.data?.id, "product", id],
        queryFn: () => api<Product>(`/products/${id}`).then((r) => r.data),
    });
    return (<div className="container page">
      <Link className="text-button back-link" href="/shop">
        <ArrowLeft size={16}/>{tr("B\u1ED9 s\u01B0u t\u1EADp")}</Link>
      <ErrorBox error={query.error} retry={() => query.refetch()}/>
      {query.data ? (<ProductContent product={query.data}/>) : (!query.error && <Skeletons count={2}/>)}
    </div>);
}
