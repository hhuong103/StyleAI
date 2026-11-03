"use client";
import { useI18n } from "@/components/locale-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, Copy, Heart, RefreshCw, ThumbsDown, ThumbsUp, Trash2, } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api, idempotency, json } from "@/lib/api";
import { percent } from "@/lib/format";
import type { Alternative, Look, LookItem, Reaction, Recommendation, SavedLook, } from "@/lib/types";
import { Modal, ProductDrawer } from "./catalog-screen";
import { Guard, useToast, useUser } from "./providers";
import { Empty, ErrorBox, PageIntro, Skeletons } from "./ui";
export function Collage({ look, interactive = false, selected, onSelect, }: {
    look: Look;
    interactive?: boolean;
    selected?: string;
    onSelect?: (slot: string) => void;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<div className={`collage collage-${look.items.length}`}>
      {look.items.map((item, index) => (<div key={item.slot_key} className={`collage-piece ${selected === item.slot_key ? "highlighted" : ""}`}>
          <img src={item.image?.url || "/editorial.svg"} alt={item.image?.alt_text || item.name} loading="lazy"/>
          {interactive && (<button className={`hotspot ${selected === item.slot_key ? "selected" : ""}`} aria-label={tr("Ch\u1ECDn {0}: {1}", { "0": label(item.role), "1": item.name })} aria-pressed={selected === item.slot_key} onClick={() => onSelect?.(item.slot_key)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
            </button>)}
        </div>))}
      <span className="collage-note">{tr("STYLEAI / YOUR PERSONAL EDIT")}</span>
    </div>);
}
export function LookCard({ look, index = 0, href, children, }: {
    look: Look;
    index?: number;
    href: string;
    children?: React.ReactNode;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<article className="look-card">
      <Link href={href}>
        <div className="look-card-visual">
          <Collage look={look}/>
          <span className="match-badge">{percent(look.score)}{" " + tr("ph\u00F9 h\u1EE3p")}</span>
        </div>
        <div className="look-card-label">
          <span>
            {String(index + 1).padStart(2, "0")} /{" "}
            {label(look.label || "YOUR LOOK")}
          </span>
          <ArrowRight size={18}/>
        </div>
        <h3>{look.name}</h3>
        <p className="look-price">{money(look.total_price_vnd)}</p>
      </Link>
      {children}
    </article>);
}
export function RecommendationsScreen() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const { id } = useParams<{
        id: string;
    }>();
    return (<Guard>
      <Recommendations id={id}/>
    </Guard>);
}
function Recommendations({ id }: {
    id: string;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const query = useQuery({
        queryKey: [user.data?.id, "recommendation", id],
        queryFn: () => api<Recommendation>(`/recommendations/${id}`).then((r) => r.data),
    });
    const rec = query.data;
    return (<div className="container page">
      <Link className="text-button back-link" href="/stylist">
        <ArrowLeft size={16}/>{tr("Ch\u1EC9nh y\u00EAu c\u1EA7u")}</Link>
      <PageIntro eyebrow={tr("THOUGHTFULLY SELECTED FOR YOU")} title={tr("M\u1ED9t y\u00EAu c\u1EA7u. Nh\u1EEFng g\u00F3c nh\u00ECn m\u1EDBi.")} description={rec
            ? tr("{0} \u00B7 {1} \u00B7 Ng\u00E2n s\u00E1ch {2}", { "0": label(rec.context.occasion), "1": label(rec.context.style), "2": money(rec.budget_max_vnd) }) : undefined}/>
      <ErrorBox error={query.error} retry={() => query.refetch()}/>
      {query.isPending && <Skeletons />}
      {rec &&
            (rec.looks.length ? (<>
            <div className="looks-grid">
              {rec.looks.map((look, index) => (<LookCard key={look.look_id} look={look} index={index} href={`/recommendations/${id}/looks/${look.look_id}`}/>))}
            </div>
            {rec.looks.length < 3 && (<p className="notice">{tr("Catalog hi\u1EC7n c\u00F3") + " "}{rec.looks.length}{" " + tr("b\u1ED9 kh\u00E1c nhau \u0111\u00E1p \u1EE9ng y\u00EAu c\u1EA7u. Ch\u00FAng t\u00F4i gi\u1EEF \u0111\u00FAng r\u00E0ng bu\u1ED9c c\u1EE7a b\u1EA1n.")}</p>)}
            <p className="fine-print">{tr("M\u1EE9c ph\u00F9 h\u1EE3p l\u00E0 \u0111i\u1EC3m heuristic t\u1EEB metadata. S\u1EA3n ph\u1EA9m v\u00E0 gi\u00E1 trong catalog DEMO l\u00E0 m\u00F4 ph\u1ECFng.")}</p>
          </>) : (<>
            <Empty title={tr("Ch\u01B0a gh\u00E9p \u0111\u01B0\u1EE3c m\u1ED9t Look ho\u00E0n ch\u1EC9nh")} description={rec.diagnostics.missing_slots.length
                    ? tr("Catalog c\u00F2n thi\u1EBFu: {0}.", { "0": rec.diagnostics.missing_slots.map((s) => label(s.toUpperCase())).join(", ") }) : tr("Ng\u00E2n s\u00E1ch kh\u1EA3 thi t\u1ED1i thi\u1EC3u hi\u1EC7n t\u1EA1i: {0}.", { "0": money(rec.diagnostics.minimum_feasible_budget_vnd || 0) })}/>
            {rec.slot_results.some((s) => s.items.length > 0) && (<section className="partial-results">
                <h2>{tr("Nh\u1EEFng m\u00F3n \u0111\u00E3 t\u00ECm th\u1EA5y")}</h2>
                {rec.slot_results.map((s) => (<div key={s.slot_key}>
                    <h3>{label(s.role)}</h3>
                    <div className="mini-grid">
                      {s.items.slice(0, 3).map((i) => (<div key={i.product_id}>
                          <img src={i.image?.url || "/editorial.svg"} alt={i.name}/>
                          <span>{i.name}</span>
                          <strong>{money(i.price_vnd)}</strong>
                        </div>))}
                    </div>
                  </div>))}
                <p>{tr("Look ch\u01B0a \u0111\u1EA7y \u0111\u1EE7 n\u00EAn ch\u01B0a th\u1EC3 l\u01B0u. B\u1EA1n c\u00F3 th\u1EC3 \u0111i\u1EC1u ch\u1EC9nh y\u00EAu c\u1EA7u.")}</p>
              </section>)}
          </>))}
    </div>);
}
export function FeedbackPanel({ targetType, targetId, }: {
    targetType: string;
    targetId: string;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const client = useQueryClient();
    const toast = useToast();
    const feedback = useQuery({
        queryKey: [user.data?.id, "feedback", targetType, targetId],
        queryFn: () => api<Reaction[]>(`/feedback?target_type=${targetType}&target_id=${targetId}`).then((r) => r.data),
    });
    const current = feedback.data?.find((r) => r.target_type === targetType && r.target_id === targetId);
    const mutation = useMutation({
        mutationFn: (value: string) => api<Reaction>("/feedback", {
            method: "POST",
            body: json({ target_type: targetType, target_id: targetId, value }),
        }),
        onSuccess: () => {
            client.invalidateQueries({ queryKey: [user.data?.id, "feedback"] });
            toast(tr("\u0110\u00E3 ghi nh\u1EADn ph\u1EA3n h\u1ED3i c\u1EE7a b\u1EA1n."));
        },
    });
    return (<div className="feedback-panel">
      <span>{tr("Look n\u00E0y c\u00F3 \u0111\u00FAng gu b\u1EA1n?")}</span>
      <div>
        <button className={`icon-button ${current?.value === "LIKE" ? "reacted" : ""}`} aria-label={tr("Th\u00EDch Look")} aria-pressed={current?.value === "LIKE"} disabled={mutation.isPending} onClick={() => mutation.mutate("LIKE")}>
          <ThumbsUp size={18}/>
        </button>
        <button className={`icon-button ${current?.value === "DISLIKE" ? "reacted" : ""}`} aria-label={tr("Kh\u00F4ng th\u00EDch Look")} aria-pressed={current?.value === "DISLIKE"} disabled={mutation.isPending} onClick={() => mutation.mutate("DISLIKE")}>
          <ThumbsDown size={18}/>
        </button>
      </div>
      <ErrorBox error={mutation.error}/>
    </div>);
}
function WhyLook({ look }: {
    look: Look;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<section className="why-look">
      <p className="eyebrow">{tr("WHY THIS LOOK?")}</p>
      <h3>{tr("M\u1ECDi l\u1EF1a ch\u1ECDn \u0111\u1EC1u c\u00F3 l\u00FD do.")}</h3>
      <div className="why-grid">
        {look.reasons.map((r) => (<div key={r.code}>
            <Check size={16}/>
            <p>
              {r.code === "OCCASION_TEMPLATE_MATCH"
                ? tr("C\u1EA5u tr\u00FAc ph\u00F9 h\u1EE3p {0}.", { "0": label(String(r.facts.occasion)).toLowerCase() }) : r.code === "STYLE_COVERAGE"
                ? tr("{0}/{1} m\u00F3n mang phong c\u00E1ch {2}.", { "0": String(r.facts.matched_items), "1": String(r.facts.total_items), "2": label(String(r.facts.style)).toLowerCase() }) : r.code === "LOOK_WITHIN_BUDGET"
                ? tr("T\u1ED5ng {0}, c\u00F2n {1} trong ng\u00E2n s\u00E1ch.", { "0": money(Number(r.facts.total_price_vnd)), "1": money(Number(r.facts.remaining_vnd)) }) : tr("B\u1EA3ng m\u00E0u: {0}.", { "0": ((r.facts.colors as string[]) || []).map((c) => label(c)).join(", ") })}
            </p>
          </div>))}
      </div>
    </section>);
}
export function InteractiveLookScreen() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const { id, lookId } = useParams<{
        id: string;
        lookId: string;
    }>();
    return (<Guard>
      <InteractiveLook id={id} lookId={lookId}/>
    </Guard>);
}
function InteractiveLook({ id, lookId }: {
    id: string;
    lookId: string;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const router = useRouter();
    const client = useQueryClient();
    const toast = useToast();
    const [selected, setSelected] = useState("");
    const [drawer, setDrawer] = useState<LookItem>();
    const [replacing, setReplacing] = useState<LookItem>();
    const query = useQuery({
        queryKey: [user.data?.id, "look", lookId],
        queryFn: () => api<Look>(`/recommendations/${id}/looks/${lookId}`).then((r) => r.data),
    });
    const path = `/recommendations/${id}/looks/${lookId}`;
    const alternatives = useQuery({
        queryKey: [user.data?.id, "alternatives", lookId, replacing?.slot_key],
        queryFn: () => api<Alternative[]>(`${path}/slots/${replacing!.slot_key}/alternatives`).then((r) => r.data),
        enabled: !!replacing,
    });
    const replacement = useMutation({
        mutationFn: ({ slot, variant }: {
            slot: string;
            variant: string;
        }) => api<Look>(`${path}/replacements`, {
            method: "POST",
            body: json({ slot_key: slot, variant_id: variant }),
            headers: idempotency(),
        }),
        onSuccess: (r) => {
            client.setQueryData([user.data?.id, "look", r.data.look_id], r.data);
            setReplacing(undefined);
            setDrawer(undefined);
            router.replace(`/recommendations/${id}/looks/${r.data.look_id}`);
            toast(tr("\u0110\u00E3 thay m\u00F3n v\u00E0 t\u00EDnh l\u1EA1i ng\u00E2n s\u00E1ch."));
        },
    });
    const save = useMutation({
        mutationFn: () => api<SavedLook>("/outfits", {
            method: "POST",
            body: json({ look_id: lookId }),
            headers: idempotency(),
        }),
        onSuccess: (r) => {
            client.invalidateQueries({ queryKey: [user.data?.id, "outfits"] });
            toast(tr("\u0110\u00E3 l\u01B0u Look c\u1EE7a b\u1EA1n."));
            router.push(`/my-looks/${r.data.id}`);
        },
    });
    const look = query.data;
    return (<div className="container page">
      <Link className="text-button back-link" href={`/recommendations/${id}`}>
        <ArrowLeft size={16}/>{tr("Nh\u1EEFng Look d\u00E0nh cho b\u1EA1n")}</Link>
      <ErrorBox error={query.error} retry={() => query.refetch()}/>
      {!look && !query.error && <Skeletons count={2}/>}{" "}
      {look && (<>
          <div className="interactive-layout">
            <Collage look={look} interactive selected={selected} onSelect={setSelected}/>
            <section className="look-panel">
              <p className="eyebrow">
                {label(look.label)}{" " + tr("/ EDIT") + " "}{look.revision}
              </p>
              <h1>{look.name}</h1>
              <span className="match-score">{percent(look.score)}{" " + tr("ph\u00F9 h\u1EE3p")}</span>
              <div className="look-items">
                {look.items.map((item, index) => (<article className={`look-item ${selected === item.slot_key ? "selected" : ""}`} key={item.slot_key} onMouseEnter={() => setSelected(item.slot_key)}>
                    <button className="item-select" onClick={() => setSelected(item.slot_key)} aria-pressed={selected === item.slot_key}>
                      <span className="item-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <strong>{item.name}</strong>
                        <span>
                          {money(item.price_vnd)}{" "}
                          <small>· {percent(item.score)}</small>
                        </span>
                        <small>
                          {item.size_code === "ONE_SIZE"
                    ? tr("Th\u00F4ng tin size ch\u01B0a c\u00F3") : item.size_code}
                        </small>
                      </span>
                    </button>
                    <div className="item-actions">
                      <button className="text-button" onClick={() => setDrawer(item)}>{tr("Chi ti\u1EBFt")}</button>
                      <button className="text-button" onClick={() => {
                    setReplacing(item);
                    replacement.reset();
                }}>
                        <RefreshCw size={13}/>{tr("Thay m\u00F3n")}</button>
                    </div>
                  </article>))}
              </div>
              <div className="look-total">
                <span>{tr("T\u1ED5ng c\u1EA3 Look")}</span>
                <strong>{money(look.total_price_vnd)}</strong>
              </div>
              <p className="within-budget">
                <Check size={15}/>{tr("Trong ng\u00E2n s\u00E1ch") + " "}{money(look.budget_max_vnd)}
              </p>
              <ErrorBox error={save.error}/>
              <button className="button full save-sticky" disabled={save.isPending || replacement.isPending} onClick={() => save.mutate()}>
                <Heart size={18}/>
                {save.isPending ? tr("\u0110ang l\u01B0u\u2026") : tr("L\u01B0u Look n\u00E0y")}
                <ArrowRight size={17}/>
              </button>
              <p className="fine-print">{tr("Gi\u00E1 m\u00F4 ph\u1ECFng. Kh\u00F4ng gi\u1EEF ch\u1ED7 ho\u1EB7c thanh to\u00E1n.")}</p>
              <FeedbackPanel targetType="LOOK" targetId={lookId}/>
            </section>
          </div>
          <WhyLook look={look}/>
        </>)}
      {drawer && (<ProductDrawer productId={drawer.product_id} selectedVariant={drawer.variant_id} onClose={() => setDrawer(undefined)} error={replacement.error} onVariant={(variant) => replacement.mutate({ slot: drawer.slot_key, variant })}/>)}
      {drawer && replacement.error && <ErrorBox error={replacement.error}/>}
      {replacing && (<Modal title={`Thay ${label(replacing.role).toLowerCase()}`} onClose={() => !replacement.isPending && setReplacing(undefined)}>
          <p>{tr("Gi\u1EEF c\u00E1c m\u00F3n kh\u00E1c. Ch\u1EC9 hi\u1EC3n th\u1ECB l\u1EF1a ch\u1ECDn c\u00F2n trong ng\u00E2n s\u00E1ch.")}</p>
          <ErrorBox error={alternatives.error || replacement.error} retry={() => alternatives.refetch()}/>
          {alternatives.isPending ? (<Skeletons count={2}/>) : alternatives.data?.length ? (<div className="alternatives">
              {alternatives.data.map((item) => (<article key={item.variant_id}>
                  <img src={item.image?.url || "/editorial.svg"} alt={item.name}/>
                  <div>
                    <h3>{item.name}</h3>
                    <p>
                      {money(item.price_vnd)} · {percent(item.score)}{" " + tr("ph\u00F9 h\u1EE3p")}</p>
                    <p>{tr("T\u1ED5ng m\u1EDBi")}{" "}
                      <strong>{money(item.new_total_price_vnd)}</strong>
                    </p>
                    <small>
                      {item.delta_price_vnd >= 0 ? "+" : ""}
                      {money(item.delta_price_vnd)}{" " + tr("\u00B7 M\u1EE9c ph\u00F9 h\u1EE3p")}{" "}
                      {percent(item.new_look_score)}
                    </small>
                    <button className="button small" disabled={replacement.isPending} onClick={() => replacement.mutate({
                        slot: replacing.slot_key,
                        variant: item.variant_id,
                    })}>{tr("Ch\u1ECDn m\u00F3n n\u00E0y") + " "}<ArrowRight size={14}/>
                    </button>
                  </div>
                </article>))}
            </div>) : (<p className="notice">{tr("Ch\u01B0a c\u00F3 l\u1EF1a ch\u1ECDn kh\u00E1c cho slot n\u00E0y trong ng\u00E2n s\u00E1ch hi\u1EC7n t\u1EA1i.")}</p>)}
        </Modal>)}
    </div>);
}
export function MyLooksScreen() {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<Guard>
      <MyLooks />
    </Guard>);
}
function MyLooks() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const params = useSearchParams();
    const router = useRouter();
    const client = useQueryClient();
    const toast = useToast();
    const [deleting, setDeleting] = useState<SavedLook>();
    const qs = params.toString();
    const query = useQuery({
        queryKey: [user.data?.id, "outfits", qs],
        queryFn: () => api<SavedLook[]>(`/outfits?${qs}`),
    });
    const mutation = useMutation({
        mutationFn: ({ row, action }: {
            row: SavedLook;
            action: string;
        }) => api(`/outfits/${row.id}${action === "duplicate" ? "/duplicate" : ""}`, {
            method: action === "delete"
                ? "DELETE"
                : action === "duplicate"
                    ? "POST"
                    : "PATCH",
            ...(action === "favorite"
                ? {
                    body: json({
                        version: row.version,
                        is_favorite: !row.is_favorite,
                    }),
                }
                : {}),
        }),
        onSuccess: () => {
            client.invalidateQueries({ queryKey: [user.data?.id, "outfits"] });
            setDeleting(undefined);
            toast(tr("\u0110\u00E3 c\u1EADp nh\u1EADt Look c\u1EE7a b\u1EA1n."));
        },
    });
    function filter(key: string, value: string) {
        const next = new URLSearchParams(qs);
        value ? next.set(key, value) : next.delete(key);
        next.delete("page");
        router.replace(`/my-looks?${next}`);
    }
    const page = Number(params.get("page") || 1);
    return (<div className="container page">
      <PageIntro eyebrow={tr("YOUR PERSONAL LOOKBOOK")} title={tr("Nh\u1EEFng Look r\u1EA5t b\u1EA1n.")} description={tr("L\u01B0u m\u1ED9t \u00FD t\u01B0\u1EDFng. Quay l\u1EA1i khi c\u1EA7n c\u1EA3m h\u1EE9ng.")} action={<Link className="button" href="/stylist">{tr("T\u1EA1o Look m\u1EDBi") + " "}<ArrowRight size={16}/>
          </Link>}/>
      <div className="collection-toolbar">
        <button className={`chip ${params.get("favorite") === "true" ? "selected" : ""}`} onClick={() => filter("favorite", params.get("favorite") === "true" ? "" : "true")}>
          <Heart size={15}/>{tr("Y\u00EAu th\u00EDch")}</button>
        <input aria-label={tr("L\u1ECDc d\u1ECBp")} placeholder={tr("M\u00E3 d\u1ECBp, v\u00ED d\u1EE5 OFFICE")} value={params.get("occasion") || ""} onChange={(e) => filter("occasion", e.target.value.toUpperCase())}/>
      </div>
      <ErrorBox error={query.error || mutation.error}/>
      {query.isPending ? (<Skeletons />) : query.data?.data.length ? (<>
          <div className="looks-grid">
            {query.data.data.map((row, index) => (<LookCard key={row.id} look={row} index={index} href={`/my-looks/${row.id}`}>
                <div className="saved-meta">
                  <span>
                    {new Date(row.created_at).toLocaleDateString("vi-VN")} ·{" "}
                    {label(row.occasion)}
                  </span>
                  <div>
                    <button className={`icon-button ${row.is_favorite ? "reacted" : ""}`} aria-label={tr("Y\u00EAu th\u00EDch")} aria-pressed={row.is_favorite} disabled={mutation.isPending} onClick={() => mutation.mutate({ row, action: "favorite" })}>
                      <Heart size={17}/>
                    </button>
                    <button className="icon-button" aria-label={tr("Nh\u00E2n b\u1EA3n Look")} disabled={mutation.isPending} onClick={() => mutation.mutate({ row, action: "duplicate" })}>
                      <Copy size={17}/>
                    </button>
                    <button className="icon-button" aria-label={tr("X\u00F3a Look")} onClick={() => setDeleting(row)}>
                      <Trash2 size={17}/>
                    </button>
                  </div>
                </div>
              </LookCard>))}
          </div>
          <div className="pagination">
            <button className="button outline small" disabled={page <= 1} onClick={() => router.replace(`/my-looks?${new URLSearchParams({ ...Object.fromEntries(params), page: String(page - 1) })}`)}>{tr("Tr\u01B0\u1EDBc")}</button>
            <span>{tr("Trang") + " "}{page}</span>
            <button className="button outline small" disabled={page * 24 >= (query.data.meta.total || 0)} onClick={() => router.replace(`/my-looks?${new URLSearchParams({ ...Object.fromEntries(params), page: String(page + 1) })}`)}>{tr("Sau")}</button>
          </div>
        </>) : (<Empty title={tr("M\u1ED9t lookbook \u0111ang ch\u1EDD b\u1EA1n.")} description={tr("Look \u0111\u1EA7u ti\u00EAn lu\u00F4n l\u00E0 kh\u1EDFi \u0111\u1EA7u c\u1EE7a m\u1ED9t phong c\u00E1ch m\u1EDBi.")}/>)}
      {deleting && (<Modal title={tr("X\u00F3a Look \u0111\u00E3 l\u01B0u?")} onClose={() => setDeleting(undefined)}>
          <p>{tr("B\u1EA1n s\u1EBD x\u00F3a \u201C")}{deleting.name}{tr("\u201D kh\u1ECFi lookbook.")}</p>
          <button className="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ row: deleting, action: "delete" })}>{tr("X\u00E1c nh\u1EADn x\u00F3a")}</button>
          <ErrorBox error={mutation.error}/>
        </Modal>)}
    </div>);
}
export function SavedLookScreen() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const { id } = useParams<{
        id: string;
    }>();
    return (<Guard>
      <SavedLookDetail id={id}/>
    </Guard>);
}
function SavedLookDetail({ id }: {
    id: string;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const query = useQuery({
        queryKey: [user.data?.id, "outfit", id],
        queryFn: () => api<SavedLook>(`/outfits/${id}`).then((r) => r.data),
    });
    const [selected, setSelected] = useState("");
    const [drawer, setDrawer] = useState<LookItem>();
    const row = query.data;
    return (<div className="container page">
      <Link className="text-button back-link" href="/my-looks">
        <ArrowLeft size={16}/>{tr("Lookbook c\u1EE7a t\u00F4i")}</Link>
      <ErrorBox error={query.error}/>
      {row ? (<>
          <div className="interactive-layout">
            <Collage look={row} interactive selected={selected} onSelect={setSelected}/>
            <section className="look-panel">
              <p className="eyebrow">{tr("SAVED IN YOUR LOOKBOOK")}</p>
              <h1>{row.name}</h1>
              <p>
                {label(row.occasion)} · {label(row.style)}
              </p>
              <span className="match-score">
                {percent(row.score)}{" " + tr("ph\u00F9 h\u1EE3p l\u00FAc l\u01B0u")}</span>
              <p className="notice">{tr("\u1EA2nh v\u00E0 gi\u00E1 t\u1EA1i th\u1EDDi \u0111i\u1EC3m l\u01B0u:")}{" "}
                {new Date(row.created_at).toLocaleDateString("vi-VN")}.
              </p>
              {row.current_status?.some((s) => !s.available || s.price_changed) && (<p className="error-box">{tr("M\u1ED9t s\u1ED1 m\u00F3n \u0111\u00E3 \u0111\u1ED5i gi\u00E1 ho\u1EB7c h\u1EBFt h\u00E0ng. Look n\u00E0y gi\u1EEF th\u00F4ng tin l\u00FAc b\u1EA1n l\u01B0u.")}</p>)}
              <div className="look-items">
                {row.items.map((i) => (<button className={`saved-item ${selected === i.slot_key ? "selected" : ""}`} key={i.slot_key} onClick={() => {
                    setSelected(i.slot_key);
                    setDrawer(i);
                }}>
                    <img src={i.image?.url || "/editorial.svg"} alt={i.name}/>
                    <span>
                      <strong>{i.name}</strong>
                      <span>{money(i.price_vnd)}</span>
                    </span>
                    <ArrowRight size={16}/>
                  </button>))}
              </div>
              <div className="look-total">
                <span>{tr("T\u1ED5ng l\u00FAc l\u01B0u")}</span>
                <strong>{money(row.total_price_vnd)}</strong>
              </div>
              <FeedbackPanel targetType="OUTFIT" targetId={id}/>
            </section>
          </div>
          <WhyLook look={row}/>
        </>) : (!query.error && <Skeletons count={2}/>)}{" "}
      {drawer && (<ProductDrawer productId={drawer.product_id} onClose={() => setDrawer(undefined)}/>)}
    </div>);
}
export function HistoryScreen() {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<Guard>
      <History />
    </Guard>);
}
function History() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const [page, setPage] = useState(1);
    const query = useQuery({
        queryKey: [user.data?.id, "history", page],
        queryFn: () => api<{
            id: string;
            context: Recommendation["context"];
            status: string;
            created_at: string;
            looks: Look[];
        }[]>(`/recommendations?page=${page}`),
    });
    return (<div className="container page">
      <PageIntro eyebrow={tr("YOUR STYLE JOURNEY")} title={tr("Nh\u1EEFng l\u1EA7n t\u00ECm c\u1EA3m h\u1EE9ng.")}/>
      <ErrorBox error={query.error}/>
      {query.isPending ? (<Skeletons />) : query.data?.data.length ? (<>
          <div className="history-list">
            {query.data.data.map((row) => (<Link key={row.id} href={`/recommendations/${row.id}`}>
                <div>
                  <p className="eyebrow">
                    {new Date(row.created_at).toLocaleString("vi-VN")}
                  </p>
                  <h3>
                    {label(row.context.occasion)} · {label(row.context.style)}
                  </h3>
                  <p>
                    {money(row.context.budget_max_vnd)} · {row.looks.length}{" "}{tr("Looks")}</p>
                </div>
                <ArrowRight size={22}/>
              </Link>))}
          </div>
          <div className="pagination">
            <button className="button outline small" disabled={page === 1} onClick={() => setPage(page - 1)}>{tr("Tr\u01B0\u1EDBc")}</button>
            <span>{page}</span>
            <button className="button outline small" disabled={page * 24 >= (query.data.meta.total || 0)} onClick={() => setPage(page + 1)}>{tr("Sau")}</button>
          </div>
        </>) : (<Empty title={tr("M\u1ED7i h\u00E0nh tr\u00ECnh b\u1EAFt \u0111\u1EA7u t\u1EEB m\u1ED9t Look.")} description={tr("Nh\u1EEFng l\u1EA7n s\u1EED d\u1EE5ng AI Stylist s\u1EBD xu\u1EA5t hi\u1EC7n t\u1EA1i \u0111\u00E2y.")}/>)}
    </div>);
}
