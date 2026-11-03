"use client";
import { useI18n } from "@/components/locale-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api, json } from "@/lib/api";
import type { Product, Rule, Taxon, Taxonomy } from "@/lib/types";
import { Modal } from "./catalog-screen";
import { Guard, useToast, useUser } from "./providers";
import { ErrorBox, PageIntro, Skeletons } from "./ui";
export function AdminShell({ children }: {
    children: React.ReactNode;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<Guard admin>
      <div className="container page">
        <div className="admin-nav">
          {[
            ["/admin", tr("T\u1ED5ng quan")],
            ["/admin/products", tr("S\u1EA3n ph\u1EA9m")],
            ["/admin/rules", "Outfit Rules"],
            ["/admin/taxonomy", tr("Taxonomy")],
        ].map(([href, text]) => (<Link href={href} key={href}>
              {text}
            </Link>))}
        </div>
        {children}
      </div>
    </Guard>);
}
export function AdminDashboard() {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<AdminShell>
      <Dashboard />
    </AdminShell>);
}
function Dashboard() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const query = useQuery({
        queryKey: [user.data?.id, "summary"],
        queryFn: () => api<Record<string, number>>("/admin/summary").then((r) => r.data),
    });
    const names: Record<string, string> = {
        users: tr("Ng\u01B0\u1EDDi d\u00F9ng"),
        products: tr("S\u1EA3n ph\u1EA9m active"),
        outfits: tr("Look \u0111\u00E3 l\u01B0u"),
        recommendations: tr("L\u1EA7n g\u1EE3i \u00FD"),
        likes: tr("Th\u00EDch"),
        dislikes: tr("Kh\u00F4ng th\u00EDch"),
    };
    return (<>
      <PageIntro eyebrow={tr("STUDIO / OVERVIEW")} title={tr("Nh\u1ECBp ho\u1EA1t \u0111\u1ED9ng.")} description={tr("S\u1ED1 li\u1EC7u \u0111\u01B0\u1EE3c t\u1ED5ng h\u1EE3p tr\u1EF1c ti\u1EBFp t\u1EEB database.")}/>
      <ErrorBox error={query.error}/>
      {query.data ? (<div className="stats-grid">
          {Object.entries(query.data).map(([key, value]) => (<article key={key}>
              <p>{names[key]}</p>
              <strong>{value.toLocaleString("vi-VN")}</strong>
            </article>))}
        </div>) : (<Skeletons />)}
      <div className="notice">
        <p>{tr("Catalog seed d\u00F9ng metadata DEMO, \u1EA3nh ch\u1EE5p tham kh\u1EA3o v\u00E0 h\u00ECnh minh h\u1ECDa. Import d\u1EEF li\u1EC7u th\u1EADt c\u1EA7n ki\u1EC3m tra quy\u1EC1n s\u1EED d\u1EE5ng, \u1EA3nh v\u00E0 gi\u00E1.")}</p>
        <Link className="text-button" href="/admin/products">{tr("Qu\u1EA3n l\u00FD catalog") + " "}<ArrowRight size={16}/>
        </Link>
      </div>
    </>);
}
function ProductEditor({ product, taxonomy, onClose, }: {
    product?: Product;
    taxonomy: Taxonomy;
    onClose: () => void;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    const [imageKey, setImageKey] = useState(product?.image?.url.replace("/media/", "") || "");
    const [uploadError, setUploadError] = useState<unknown>();
    const [uploading, setUploading] = useState(false);
    const user = useUser();
    const client = useQueryClient();
    const save = useMutation({
        mutationFn: (body: unknown) => api(product ? `/products/${product.id}` : "/products", {
            method: product ? "PUT" : "POST",
            body: json(body),
        }),
        onSuccess: () => {
            client.invalidateQueries({ queryKey: [user.data?.id, "admin-products"] });
            onClose();
        },
    });
    async function upload(file: File) {
        setUploading(true);
        setUploadError(undefined);
        const data = new FormData();
        data.append("file", file);
        try {
            const response = await api<{
                storage_key: string;
            }>("/admin/uploads/images", { method: "POST", body: data });
            setImageKey(response.data.storage_key);
        }
        catch (e) {
            setUploadError(e);
        }
        finally {
            setUploading(false);
        }
    }
    function submit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const body: Record<string, unknown> = {
            product_code: form.get("product_code"),
            name: form.get("name"),
            brand: form.get("brand") || null,
            category_code: form.get("category_code"),
            color_code: form.get("color_code"),
            gender: form.get("gender"),
            base_price_vnd: Number(form.get("base_price_vnd")),
            description: form.get("description"),
            active: form.get("active") === "on",
            price_source: form.get("price_source"),
            image_key: imageKey,
            styles: form.getAll("styles"),
            occasions: form.getAll("occasions"),
        };
        if (!product)
            body.variants = [
                {
                    sku: form.get("sku"),
                    size_code: form.get("size_code") || "ONE_SIZE",
                    available: true,
                },
            ];
        save.mutate(body);
    }
    return (<Modal title={product ? tr("S\u1EEDa s\u1EA3n ph\u1EA9m") : tr("Th\u00EAm s\u1EA3n ph\u1EA9m")} onClose={onClose}>
      <form className="admin-form" onSubmit={submit}>
        <div className="field-row">
          <label>{tr("M\u00E3 s\u1EA3n ph\u1EA9m")}<input name="product_code" required pattern="[A-Za-z0-9_-]+" defaultValue={product?.product_code} readOnly={!!product}/>
          </label>
          <label>{tr("T\u00EAn")}<input name="name" required defaultValue={product?.name}/>
          </label>
        </div>
        <div className="field-row">
          <label>{tr("Th\u01B0\u01A1ng hi\u1EC7u")}<input name="brand" defaultValue={product?.brand || ""}/>
          </label>
          <label>{tr("Gi\u00E1 c\u01A1 b\u1EA3n (VND)")}<input name="base_price_vnd" type="number" required min={0} defaultValue={product?.base_price_vnd || 0}/>
          </label>
        </div>
        <div className="field-row">
          <label>{tr("Category")}<select name="category_code" defaultValue={product?.category}>
              {taxonomy.categories.map((c) => (<option key={c.code} value={c.code}>
                  {c.label}
                </option>))}
            </select>
          </label>
          <label>{tr("M\u00E0u")}<select name="color_code" defaultValue={product?.color}>
              {taxonomy.colors.map((c) => (<option key={c.code} value={c.code}>
                  {c.label}
                </option>))}
            </select>
          </label>
        </div>
        <div className="field-row">
          <label>{tr("Gender")}<select name="gender" defaultValue={product?.gender || "UNISEX"}>
              <option>{tr("UNISEX")}</option>
              <option>{tr("MALE")}</option>
              <option>{tr("FEMALE")}</option>
            </select>
          </label>
          <label>{tr("Ngu\u1ED3n gi\u00E1")}<select name="price_source" defaultValue={product?.price_source || "DEMO"}>
              <option>DEMO</option>
              <option>REAL</option>
            </select>
          </label>
        </div>
        <div className="field-row">
          <label>{tr("Styles (Ctrl/Cmd \u0111\u1EC3 ch\u1ECDn nhi\u1EC1u)")}<select multiple name="styles" defaultValue={product?.styles || []}>
              {taxonomy.styles.map((c) => (<option key={c.code} value={c.code}>
                  {c.label}
                </option>))}
            </select>
          </label>
          <label>{tr("Occasions")}<select multiple name="occasions" defaultValue={product?.occasions || []}>
              {taxonomy.occasions.map((c) => (<option key={c.code} value={c.code}>
                  {c.label}
                </option>))}
            </select>
          </label>
        </div>
        <label>{tr("M\u00F4 t\u1EA3")}<textarea name="description" defaultValue={product?.description}/>
        </label>
        <label>{tr("\u1EA2nh JPEG/PNG/WebP, t\u1ED1i \u0111a 5 MB")}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file)
                upload(file);
        }}/>
        </label>
        {imageKey && (<img className="upload-preview" src={`/media/${imageKey}`} alt={tr("\u1EA2nh s\u1EA3n ph\u1EA9m \u0111\u00E3 ch\u1ECDn")}/>)}
        {!product && (<div className="field-row">
            <label>
              SKU
              <input name="sku" required/>
            </label>
            <label>{tr("Size (b\u1ECF tr\u1ED1ng n\u1EBFu ch\u01B0a c\u00F3)")}<input name="size_code"/>
            </label>
          </div>)}
        <label className="checkbox-label">
          <input name="active" type="checkbox" defaultChecked={product?.active ?? true}/>{tr("\u0110ang ho\u1EA1t \u0111\u1ED9ng")}</label>
        <ErrorBox error={save.error || uploadError}/>
        <button className="button" disabled={!imageKey || save.isPending || uploading}>
          {uploading
            ? tr("\u0110ang t\u1EA3i \u1EA3nh\u2026") : save.isPending
            ? tr("\u0110ang l\u01B0u\u2026") : tr("L\u01B0u s\u1EA3n ph\u1EA9m")}
        </button>
      </form>
    </Modal>);
}
type ImportReport = {
    import_id: string;
    status: string;
    records: number;
    valid: number;
    errors: {
        row: number;
        message: string;
    }[] | number;
};
function ImportCatalog() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const client = useQueryClient();
    const [report, setReport] = useState<ImportReport>();
    const [error, setError] = useState<unknown>();
    const [pending, setPending] = useState(false);
    async function validate(file: File) {
        setPending(true);
        setError(undefined);
        setReport(undefined);
        const form = new FormData();
        form.append("file", file);
        try {
            setReport((await api<ImportReport>("/admin/catalog-imports/validate", {
                method: "POST",
                body: form,
            })).data);
        }
        catch (e) {
            setError(e);
        }
        finally {
            setPending(false);
        }
    }
    async function commit() {
        setPending(true);
        try {
            const response = await api<ImportReport>(`/admin/catalog-imports/${report!.import_id}/commit`, { method: "POST" });
            setReport(response.data);
            client.invalidateQueries({ queryKey: [user.data?.id, "admin-products"] });
        }
        catch (e) {
            setError(e);
        }
        finally {
            setPending(false);
        }
    }
    return (<section className="import-box">
      <div>
        <Upload size={20}/>
        <h3>{tr("Import catalog")}</h3>
      </div>
      <p>{tr("CSV/JSON t\u1ED1i \u0111a 10 MB, 5.000 s\u1EA3n ph\u1EA9m. Validate tr\u01B0\u1EDBc, commit sau; file c\u1EA7n image_key \u0111\u00E3 c\u00F3 trong storage.")}</p>
      <input aria-label={tr("File catalog")} type="file" accept=".csv,.json" disabled={pending} onChange={(e) => {
            if (e.target.files?.[0])
                validate(e.target.files[0]);
        }}/>
      <ErrorBox error={error}/>
      {pending && <p role="status">{tr("\u0110ang x\u1EED l\u00FD file\u2026")}</p>}
      {report && (<div>
          <p>
            {report.status} · {report.valid}/{report.records}{" " + tr("s\u1EA3n ph\u1EA9m h\u1EE3p l\u1EC7")}</p>
          {Array.isArray(report.errors) && report.errors.length > 0 && (<ul>
              {report.errors.slice(0, 15).map((e, i) => (<li key={i}>{tr("D\u00F2ng") + " "}{e.row}: {e.message}
                </li>))}
            </ul>)}
          {report.status === "VALIDATED" && (<button className="button small" disabled={pending} onClick={commit}>{tr("Commit import")}</button>)}
        </div>)}
    </section>);
}
export function AdminProducts() {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<AdminShell>
      <Products />
    </AdminShell>);
}
function Products() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const client = useQueryClient();
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [edit, setEdit] = useState<Product | "new">();
    const [deleting, setDeleting] = useState<Product>();
    const products = useQuery({
        queryKey: [user.data?.id, "admin-products", page, search],
        queryFn: () => api<Product[]>(`/products?include_inactive=true&page=${page}&q=${encodeURIComponent(search)}`),
    });
    const tax = useQuery({
        queryKey: [user.data?.id, "taxonomy"],
        queryFn: () => api<Taxonomy>("/taxonomy").then((r) => r.data),
    });
    const remove = useMutation({
        mutationFn: (id: string) => api(`/products/${id}`, { method: "DELETE" }),
        onSuccess: () => {
            client.invalidateQueries({ queryKey: [user.data?.id, "admin-products"] });
            setDeleting(undefined);
        },
    });
    return (<>
      <PageIntro eyebrow={tr("STUDIO / CATALOG")} title={tr("B\u1ED9 s\u01B0u t\u1EADp trong tay b\u1EA1n.")} action={<button className="button" onClick={() => setEdit("new")}>
            <Plus size={17}/>{tr("Th\u00EAm s\u1EA3n ph\u1EA9m")}</button>}/>
      <ImportCatalog />
      <label className="admin-search">{tr("T\u00ECm s\u1EA3n ph\u1EA9m")}<input value={search} onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
        }}/>
      </label>
      <ErrorBox error={products.error || remove.error}/>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tr("S\u1EA3n ph\u1EA9m")}</th>
              <th>{tr("Gi\u00E1")}</th>
              <th>{tr("Tr\u1EA1ng th\u00E1i")}</th>
              <th>{tr("Thao t\u00E1c")}</th>
            </tr>
          </thead>
          <tbody>
            {products.data?.data.map((p) => (<tr key={p.id}>
                <td>
                  <div className="table-product">
                    <img src={p.image?.url || "/editorial.svg"} alt=""/>
                    <div>
                      <strong>{p.name}</strong>
                      <small>{p.product_code}</small>
                    </div>
                  </div>
                </td>
                <td>
                  {money(p.price_vnd)}
                  <small>{p.price_source}</small>
                </td>
                <td>
                  {p.active
                ? p.available
                    ? tr("C\u00F2n h\u00E0ng") : tr("H\u1EBFt h\u00E0ng")
                : tr("\u0110\u00E3 t\u1EAFt")}
                </td>
                <td>
                  <div className="table-actions">
                    <button className="text-button" onClick={() => setEdit(p)}>{tr("S\u1EEDa")}</button>
                    <Link className="text-button" href={`/admin/products/${p.id}/variants`}>{tr("Variants")}</Link>
                    <button className="text-button" disabled={!p.active} onClick={() => setDeleting(p)}>{tr("T\u1EAFt")}</button>
                  </div>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button className="button small outline" disabled={page === 1} onClick={() => setPage(page - 1)}>{tr("Tr\u01B0\u1EDBc")}</button>
        <span>{page}</span>
        <button className="button small outline" disabled={page * 24 >= (products.data?.meta.total || 0)} onClick={() => setPage(page + 1)}>{tr("Sau")}</button>
      </div>
      {edit && tax.data && (<ProductEditor product={edit === "new" ? undefined : edit} taxonomy={tax.data} onClose={() => setEdit(undefined)}/>)}{" "}
      {deleting && (<Modal title={tr("Ng\u1EEBng ho\u1EA1t \u0111\u1ED9ng s\u1EA3n ph\u1EA9m?")} onClose={() => setDeleting(undefined)}>
          <p>
            {deleting.name}{" " + tr("s\u1EBD kh\u00F4ng xu\u1EA5t hi\u1EC7n trong g\u1EE3i \u00FD m\u1EDBi. L\u1ECBch s\u1EED \u0111\u00E3 l\u01B0u v\u1EABn gi\u1EEF nguy\u00EAn.")}</p>
          <button className="button" disabled={remove.isPending} onClick={() => remove.mutate(deleting.id)}>{tr("X\u00E1c nh\u1EADn t\u1EAFt")}</button>
        </Modal>)}
    </>);
}
export function AdminVariants() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const { id } = useParams<{
        id: string;
    }>();
    return (<AdminShell>
      <Variants id={id}/>
    </AdminShell>);
}
function Variants({ id }: {
    id: string;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const client = useQueryClient();
    const toast = useToast();
    const product = useQuery({
        queryKey: [user.data?.id, "variants", id],
        queryFn: () => api<Product>(`/products/${id}`).then((r) => r.data),
    });
    const update = useMutation({
        mutationFn: ({ variant, body }: {
            variant?: string;
            body: unknown;
        }) => api(`/products/${id}/variants${variant ? `/${variant}` : ""}`, {
            method: variant ? "PATCH" : "POST",
            body: json(body),
        }),
        onSuccess: () => {
            client.invalidateQueries({ queryKey: [user.data?.id, "variants", id] });
            toast(tr("\u0110\u00E3 c\u1EADp nh\u1EADt bi\u1EBFn th\u1EC3."));
        },
    });
    return (<>
      <PageIntro eyebrow={tr("STUDIO / VARIANTS")} title={product.data?.name || tr("Bi\u1EBFn th\u1EC3 s\u1EA3n ph\u1EA9m")}/>
      <ErrorBox error={product.error || update.error}/>
      {product.data?.variants.map((v) => (<form className="variant-row" key={v.id} onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                update.mutate({
                    variant: v.id,
                    body: {
                        price_override_vnd: form.get("price")
                            ? Number(form.get("price"))
                            : null,
                        available: form.get("available") === "on",
                        active: form.get("active") === "on",
                    },
                });
            }}>
          <div>
            <strong>{v.size_code}</strong>
            <small>{v.sku}</small>
          </div>
          <label>{tr("Gi\u00E1 override")}<input type="number" min={0} name="price" placeholder={String(product.data?.base_price_vnd)} defaultValue={v.price_override_vnd ?? ""}/>
          </label>
          <label className="checkbox-label">
            <input type="checkbox" name="available" defaultChecked={v.available}/>{tr("C\u00F2n h\u00E0ng")}</label>
          <label className="checkbox-label">
            <input type="checkbox" name="active" defaultChecked={v.active}/>{tr("Active")}</label>
          <button className="button small" disabled={update.isPending}>{tr("L\u01B0u")}</button>
        </form>))}
      <h2>{tr("Th\u00EAm bi\u1EBFn th\u1EC3")}</h2>
      <form className="variant-row" onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            update.mutate({
                body: {
                    sku: f.get("sku"),
                    size_code: f.get("size"),
                    available: true,
                },
            });
        }}>
        <label>
          SKU
          <input name="sku" required/>
        </label>
        <label>{tr("Size")}<input name="size" required/>
        </label>
        <button className="button small" disabled={update.isPending}>{tr("Th\u00EAm")}</button>
      </form>
    </>);
}
export function AdminTaxonomy() {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<AdminShell>
      <TaxonomyManager />
    </AdminShell>);
}
function TaxonomyManager() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const client = useQueryClient();
    const [kind, setKind] = useState<keyof Taxonomy>("categories");
    const [edit, setEdit] = useState<Taxon | "new">();
    const query = useQuery({
        queryKey: [user.data?.id, "admin-taxonomy"],
        queryFn: () => api<Taxonomy>("/admin/taxonomy").then((r) => r.data),
    });
    const save = useMutation({
        mutationFn: (body: unknown) => api(`/admin/taxonomy/${kind}${edit !== "new" && edit ? `/${edit.code}` : ""}`, { method: edit === "new" ? "POST" : "PUT", body: json(body) }),
        onSuccess: () => {
            client.invalidateQueries({ queryKey: [user.data?.id, "admin-taxonomy"] });
            client.invalidateQueries({ queryKey: [user.data?.id, "taxonomy"] });
            setEdit(undefined);
        },
    });
    const value = edit && edit !== "new" ? edit : undefined;
    return (<>
      <PageIntro eyebrow={tr("STUDIO / TAXONOMY")} title={tr("Ng\u00F4n ng\u1EEF c\u1EE7a catalog.")}/>
      <div className="chips">
        {(["categories", "styles", "occasions", "colors"] as const).map((k) => (<button className={`chip ${kind === k ? "selected" : ""}`} onClick={() => setKind(k)} key={k}>
            {k}
          </button>))}
        <button className="button small" onClick={() => {
            save.reset();
            setEdit("new");
        }}>
          <Plus size={15}/>{tr("Th\u00EAm")}</button>
      </div>
      <ErrorBox error={query.error}/>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tr("Code")}</th>
              <th>{tr("Nh\u00E3n")}</th>
              <th>{tr("Active")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {query.data?.[kind].map((row) => (<tr key={row.code}>
                <td>{row.code}</td>
                <td>{row.label}</td>
                <td>{row.active ? tr("C\u00F3") : tr("Kh\u00F4ng")}</td>
                <td>
                  <button className="text-button" onClick={() => {
                save.reset();
                setEdit(row);
            }}>{tr("S\u1EEDa")}</button>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
      {edit && (<Modal title={`Taxonomy / ${kind}`} onClose={() => setEdit(undefined)}>
          <form className="admin-form" onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                save.mutate({
                    code: f.get("code"),
                    label: f.get("label"),
                    active: f.get("active") === "on",
                    ...(kind === "categories"
                        ? {
                            item_role: f.get("item_role"),
                            parent_code: f.get("parent_code") || null,
                        }
                        : {}),
                    ...(kind === "colors"
                        ? { hex: f.get("hex"), family: f.get("family") }
                        : {}),
                });
            }}>
            <label>{tr("Code")}<input name="code" required pattern="[A-Z][A-Z0-9_]*" defaultValue={value?.code} readOnly={!!value}/>
            </label>
            <label>{tr("Nh\u00E3n")}<input name="label" required defaultValue={value?.label}/>
            </label>
            {kind === "categories" && (<>
                <label>{tr("Role")}<select name="item_role" defaultValue={value?.item_role}>
                    {["TOP", "BOTTOM", "OUTERWEAR", "SHOES"].map((r) => (<option key={r}>{r}</option>))}
                  </select>
                </label>
                <label>{tr("Parent code")}<input name="parent_code" defaultValue={value?.parent_code || ""}/>
                </label>
              </>)}
            {kind === "colors" && (<>
                <label>{tr("Hex")}<input type="color" name="hex" defaultValue={value?.hex || "#252525"}/>
                </label>
                <label>{tr("Family")}<select name="family" defaultValue={value?.family}>
                    <option>{tr("NEUTRAL")}</option>
                    <option>{tr("WARM")}</option>
                    <option>{tr("COOL")}</option>
                  </select>
                </label>
              </>)}
            <label className="checkbox-label">
              <input type="checkbox" name="active" defaultChecked={value?.active ?? true}/>{tr("Active")}</label>
            <ErrorBox error={save.error}/>
            <button className="button" disabled={save.isPending}>{tr("L\u01B0u taxonomy")}</button>
          </form>
        </Modal>)}
    </>);
}
export function AdminRules() {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<AdminShell>
      <RuleManager />
    </AdminShell>);
}
function RuleManager() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const client = useQueryClient();
    const [open, setOpen] = useState(false);
    const [source, setSource] = useState<Rule>();
    const [localError, setLocalError] = useState<unknown>();
    const query = useQuery({
        queryKey: [user.data?.id, "rules"],
        queryFn: () => api<Rule[]>("/admin/outfit-rules").then((r) => r.data),
    });
    const tax = useQuery({
        queryKey: [user.data?.id, "taxonomy"],
        queryFn: () => api<Taxonomy>("/taxonomy").then((r) => r.data),
    });
    const create = useMutation({
        mutationFn: (body: unknown) => api("/admin/outfit-rules", { method: "POST", body: json(body) }),
        onSuccess: () => {
            client.invalidateQueries({ queryKey: [user.data?.id, "rules"] });
            setOpen(false);
        },
    });
    const publish = useMutation({
        mutationFn: (id: string) => api(`/admin/outfit-rules/${id}/publish`, { method: "POST" }),
        onSuccess: () => client.invalidateQueries({ queryKey: [user.data?.id, "rules"] }),
    });
    return (<>
      <PageIntro eyebrow={tr("STUDIO / OUTFIT RULES")} title={tr("C\u1EA5u tr\u00FAc tr\u01B0\u1EDBc, c\u1EA3m h\u1EE9ng sau.")} action={<button className="button" onClick={() => {
                setSource(undefined);
                setOpen(true);
                setLocalError(undefined);
                create.reset();
            }}>
            <Plus size={16}/>{tr("T\u1EA1o rule")}</button>}/>
      <ErrorBox error={query.error || publish.error}/>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tr("Rule")}</th>
              <th>{tr("Context")}</th>
              <th>{tr("Slots")}</th>
              <th>{tr("Tr\u1EA1ng th\u00E1i")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {query.data?.map((r) => (<tr key={r.id}>
                <td>
                  {r.rule_key}
                  <small>v{r.version}</small>
                </td>
                <td>
                  {label(r.occasion_code)}
                  <small>{label(r.style_code || "ANY")}</small>
                </td>
                <td>{r.slots.map((s) => s.role).join(" + ")}</td>
                <td>{r.active ? "Published" : "Draft"}</td>
                <td>
                  <div className="table-actions">
                    <button className="text-button" onClick={() => {
                setSource(r);
                setOpen(true);
                setLocalError(undefined);
                create.reset();
            }}>{tr("Phi\u00EAn b\u1EA3n m\u1EDBi")}</button>
                    {!r.active && (<button className="text-button" disabled={publish.isPending} onClick={() => publish.mutate(r.id)}>{tr("Publish")}</button>)}
                  </div>
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
      {open && (<Modal title={tr("Rule / phi\u00EAn b\u1EA3n b\u1EA5t bi\u1EBFn")} onClose={() => setOpen(false)}>
          <form className="admin-form" onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                try {
                    const slots = JSON.parse(String(f.get("slots")));
                    setLocalError(undefined);
                    create.mutate({
                        rule_key: f.get("key"),
                        occasion_code: f.get("occasion"),
                        style_code: f.get("style") || null,
                        slots,
                        priority: 0,
                    });
                }
                catch {
                    setLocalError(new Error(tr("Slots JSON ch\u01B0a h\u1EE3p l\u1EC7.")));
                }
            }}>
            <label>{tr("Rule key")}<input name="key" required pattern="[a-z0-9_]+" defaultValue={source?.rule_key}/>
            </label>
            <label>{tr("Occasion")}<select name="occasion" defaultValue={source?.occasion_code}>
                {tax.data?.occasions.map((o) => (<option value={o.code} key={o.code}>
                    {o.label}
                  </option>))}
              </select>
            </label>
            <label>{tr("Style")}<select name="style" defaultValue={source?.style_code || ""}>
                <option value="">{tr("Fallback c\u00F9ng occasion")}</option>
                {tax.data?.styles.map((s) => (<option value={s.code} key={s.code}>
                    {s.label}
                  </option>))}
              </select>
            </label>
            <label>{tr("Slots JSON")}<textarea className="code-input" name="slots" required rows={10} defaultValue={JSON.stringify(source?.slots || [
                {
                    slot_key: "top",
                    role: "TOP",
                    categories: ["SHIRT"],
                    required: true,
                },
                {
                    slot_key: "bottom",
                    role: "BOTTOM",
                    categories: ["TROUSERS"],
                    required: true,
                },
                {
                    slot_key: "shoes",
                    role: "SHOES",
                    categories: ["LOAFERS"],
                    required: true,
                },
            ], null, 2)}/>
            </label>
            <p>{tr("Rule m\u1EDBi \u1EDF tr\u1EA1ng th\u00E1i draft. Publish s\u1EBD ki\u1EC3m tra coverage catalog v\u00E0 t\u1EAFt phi\u00EAn b\u1EA3n c\u0169 c\u00F9ng key.")}</p>
            <ErrorBox error={localError || create.error}/>
            <button className="button" disabled={create.isPending}>{tr("L\u01B0u draft")}</button>
          </form>
        </Modal>)}
    </>);
}
