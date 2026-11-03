"use client";
import { useI18n } from "@/components/locale-provider";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, LoaderCircle, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, idempotency, json } from "@/lib/api";
import type { Context, Plan, Profile, Recommendation, Taxonomy, } from "@/lib/types";
import { Guard, useToast, useUser } from "./providers";
import { ErrorBox, PageIntro } from "./ui";
export function Chips({ items, selected, onSelect, multiple = false, }: {
    items: {
        code: string;
        label: string;
    }[];
    selected: string[];
    onSelect: (value: string[]) => void;
    multiple?: boolean;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<div className="chips">
      {items.map((item) => (<button type="button" className={`chip ${selected.includes(item.code) ? "selected" : ""}`} key={item.code} aria-pressed={selected.includes(item.code)} onClick={() => onSelect(multiple
                ? selected.includes(item.code)
                    ? selected.filter((c) => c !== item.code)
                    : [...selected, item.code]
                : [item.code])}>
          {item.label}
          {selected.includes(item.code) && <Check size={13}/>}
        </button>))}
    </div>);
}
export function Colors({ taxonomy, selected, onSelect, }: {
    taxonomy: Taxonomy;
    selected: string[];
    onSelect: (value: string[]) => void;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<div className="swatches">
      {taxonomy.colors.map((c) => (<button type="button" key={c.code} aria-label={c.label} title={c.label} aria-pressed={selected.includes(c.code)} className={`swatch ${selected.includes(c.code) ? "selected" : ""}`} style={{ "--swatch": c.hex } as React.CSSProperties} onClick={() => onSelect(selected.includes(c.code)
                ? selected.filter((s) => s !== c.code)
                : [...selected, c.code])}>
          <span />
          {selected.includes(c.code) && <Check size={16}/>}
        </button>))}
      <button type="button" className="text-button" onClick={() => onSelect([])}>{tr("Kh\u00F4ng \u01B0u ti\u00EAn")}</button>
    </div>);
}
export function StylistScreen() {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<Guard>
      <Stylist />
    </Guard>);
}
function Stylist() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const router = useRouter();
    const params = useSearchParams();
    const toast = useToast();
    const taxonomy = useQuery({
        queryKey: [user.data?.id, "taxonomy"],
        queryFn: () => api<Taxonomy>("/taxonomy").then((r) => r.data),
    });
    const profile = useQuery({
        queryKey: [user.data?.id, "profile"],
        queryFn: () => api<Profile>("/users/me/profile").then((r) => r.data),
    });
    const [text, setText] = useState("");
    const [parsed, setParsed] = useState(false);
    const [plan, setPlan] = useState<Plan>();
    const [phase, setPhase] = useState("");
    const [context, setContext] = useState<Context>({
        gender: null,
        occasion: params.get("occasion") || "DAILY",
        style: "CASUAL",
        preferred_colors: [],
        budget_max_vnd: 1500000,
    });
    const initialized = useRef(false);
    useEffect(() => {
        if (profile.data && !initialized.current) {
            initialized.current = true;
            setContext((c) => ({
                ...c,
                gender: profile.data.gender,
                style: profile.data.preferred_styles[0] || "CASUAL",
                preferred_colors: profile.data.favorite_colors,
                budget_max_vnd: profile.data.budget_max_vnd || 1500000,
            }));
        }
    }, [profile.data]);
    function patch(values: Partial<Context>) {
        setContext((c) => ({ ...c, ...values }));
        setPlan(undefined);
    }
    const mutation = useMutation({
        mutationFn: async () => {
            setPhase("plan");
            if (text.trim() && !parsed) {
                const p = (await api<Plan>("/stylist/plan", {
                    method: "POST",
                    body: json({ text, context: {} }),
                })).data;
                setContext(p.normalized_context);
                setPlan(p);
                setParsed(true);
                setPhase("");
                toast(tr("\u0110\u00E3 hi\u1EC3u m\u00F4 t\u1EA3. Ki\u1EC3m tra c\u00E1c l\u1EF1a ch\u1ECDn b\u00EAn d\u01B0\u1EDBi r\u1ED3i t\u1EA1o Look."));
                return;
            }
            const p = (await api<Plan>("/stylist/plan", {
                method: "POST",
                body: json({ text, context }),
            })).data;
            setPlan(p);
            if (p.needs_confirmation.length) {
                setPhase("");
                return;
            }
            setPhase("recommend");
            const rec = (await api<Recommendation>("/recommendations", {
                method: "POST",
                body: json({ plan_id: p.plan_id, top_k: 5 }),
                headers: idempotency(),
            })).data;
            router.push(`/recommendations/${rec.recommendation_id}`);
        },
        onError: () => setPhase(""),
    });
    return (<div className="container page stylist-page">
      <PageIntro eyebrow={tr("YOUR NEXT CHAPTER, STYLED")} title={tr("H\u00F4m nay, b\u1EA1n mu\u1ED1n l\u00E0 ai?")} description={tr("K\u1EC3 m\u1ED9t ch\u00FAt v\u1EC1 k\u1EBF ho\u1EA1ch c\u1EE7a b\u1EA1n. Ch\u00FAng t\u00F4i s\u1EBD ph\u1ED1i nh\u1EEFng m\u00F3n \u0111\u1ED3 th\u00E0nh m\u1ED9t Look c\u00F3 l\u00FD do.")}/>
      <div className="stylist-layout">
        <section className="stylist-form">
          <div className="prompt-box">
            <div className="prompt-heading">
              <Sparkles size={19}/>
              <span>{tr("G\u1EECI M\u1ED8T L\u1EDCI NH\u1EAEN CHO STYLIST")}</span>
            </div>
            <textarea aria-label={tr("M\u00F4 t\u1EA3 nhu c\u1EA7u ph\u1ED1i \u0111\u1ED3")} maxLength={2000} placeholder={tr("T\u00F4i c\u1EA7n outfit \u0111i ph\u1ECFng v\u1EA5n, phong c\u00E1ch t\u1ED1i gi\u1EA3n, d\u01B0\u1EDBi 1,5 tri\u1EC7u\u2026")} value={text} onChange={(e) => {
            setText(e.target.value);
            setParsed(false);
        }}/>
            <p>
              {text.length}/2000{" "}
              <span>{tr("M\u00F4 t\u1EA3 nhu c\u1EA7u ho\u1EB7c ch\u1ECDn tr\u1EF1c ti\u1EBFp b\u00EAn d\u01B0\u1EDBi.")}</span>
            </p>
          </div>
          {plan && (<div className="understood">
              <Check size={18}/>
              <span>{tr("\u0110\u00E3 hi\u1EC3u:") + " "}{label(plan.normalized_context.occasion)} ·{" "}
                {label(plan.normalized_context.style)} · ≤{" "}
                {money(plan.normalized_context.budget_max_vnd)}
              </span>
            </div>)}
          {taxonomy.data && (<>
              <div className="form-section">
                <h3>
                  <span>01</span>{tr("B\u1EA1n s\u1EBD \u0111i \u0111\u00E2u?")}</h3>
                <Chips items={taxonomy.data.occasions} selected={[context.occasion]} onSelect={(v) => patch({ occasion: v[0] })}/>
              </div>
              <div className="form-section">
                <h3>
                  <span>02</span>{tr("M\u1ED9t ch\u00FAt phong c\u00E1ch c\u1EE7a b\u1EA1n")}</h3>
                <Chips items={taxonomy.data.styles} selected={[context.style]} onSelect={(v) => patch({ style: v[0] })}/>
              </div>
              <div className="form-section">
                <h3>
                  <span>03</span>{tr("M\u00E0u s\u1EAFc b\u1EA1n mu\u1ED1n di\u1EC7n")}</h3>
                <Colors taxonomy={taxonomy.data} selected={context.preferred_colors} onSelect={(v) => patch({ preferred_colors: v })}/>
              </div>
            </>)}
          <div className="form-section">
            <h3>
              <span>04</span>{tr("Ng\u00E2n s\u00E1ch cho c\u1EA3 Look")}</h3>
            <div className="budget-value">{money(context.budget_max_vnd)}</div>
            <input aria-label={tr("Thanh ng\u00E2n s\u00E1ch")} type="range" min={300000} max={5000000} step={50000} value={context.budget_max_vnd} onChange={(e) => patch({ budget_max_vnd: Number(e.target.value) })}/>
            <div className="budget-endpoints">
              <span>300.000 ₫</span>
              <span>5.000.000 ₫</span>
            </div>
            <label>{tr("Nh\u1EADp ng\u00E2n s\u00E1ch (VND)")}<input type="number" min={1} max={100000000} value={context.budget_max_vnd || ""} onChange={(e) => patch({ budget_max_vnd: Number(e.target.value) })}/>
            </label>
            <label>{tr("Gender / ng\u1EEF c\u1EA3nh")}<select value={context.gender || ""} onChange={(e) => patch({ gender: e.target.value || null })}>
                <option value="">{tr("Kh\u00F4ng gi\u1EDBi h\u1EA1n")}</option>
                <option value="FEMALE">{tr("N\u1EEF")}</option>
                <option value="MALE">{tr("Nam")}</option>
                <option value="UNISEX">{tr("Unisex")}</option>
              </select>
            </label>
          </div>
          <ErrorBox error={mutation.error || taxonomy.error}/>
          <button className="button full accent" disabled={mutation.isPending || !context.budget_max_vnd} onClick={() => mutation.mutate()}>
            {mutation.isPending ? (<>
                <LoaderCircle className="spin" size={18}/>{tr("\u0110ang chu\u1EA9n b\u1ECB Look\u2026")}</>) : (<>
                {text.trim() && !parsed
                ? tr("Hi\u1EC3u y\u00EAu c\u1EA7u c\u1EE7a t\u00F4i") : tr("T\u1EA1o Look d\u00E0nh cho t\u00F4i")}
                <ArrowRight size={18}/>
              </>)}
          </button>
          <p className="fine-print">{tr("G\u1EE3i \u00FD t\u1EEB catalog DEMO; t\u1ED5ng gi\u00E1 \u0111\u01B0\u1EE3c ki\u1EC3m tra theo ng\u00E2n s\u00E1ch b\u1EA1n ch\u1ECDn.")}</p>
        </section>
        <aside className="stylist-aside">
          <img src="/editorial.svg" alt={tr("Minh h\u1ECDa b\u1ED9 trang ph\u1EE5c trung t\u00EDnh")}/>
          <p className="eyebrow">{tr("THOUGHTFULLY PUT TOGETHER.")}</p>
          <h2>{tr("M\u1ED7i m\u00F3n \u0111\u1ED3,")}<br />
            <em>{tr("m\u1ED9t l\u00FD do.")}</em>
          </h2>
          <p>{tr("H\u1EE3p ho\u00E0n c\u1EA3nh. \u0110\u00FAng tinh th\u1EA7n. V\u1EEBa ng\u00E2n s\u00E1ch. V\u00E0 lu\u00F4n c\u00F3 ch\u1ED7 cho l\u1EF1a ch\u1ECDn c\u1EE7a b\u1EA1n.")}</p>
          {mutation.isPending && (<div className="processing" role="status" aria-live="polite">
              <p>
                {phase === "plan" ? (<LoaderCircle className="spin" size={17}/>) : (<Check size={17}/>)}{tr("\u0110ang hi\u1EC3u nhu c\u1EA7u c\u1EE7a b\u1EA1n")}</p>
              {phase === "recommend" && (<>
                  <p>
                    <Check size={17}/>{tr("\u0110\u00E3 t\u1EA1o c\u1EA5u tr\u00FAc trang ph\u1EE5c")}</p>
                  <p>
                    <LoaderCircle className="spin" size={17}/>{tr("\u0110ang t\u00ECm v\u00E0 gh\u00E9p Look trong ng\u00E2n s\u00E1ch")}</p>
                </>)}
            </div>)}
        </aside>
      </div>
    </div>);
}
export function ProfileScreen() {
    const { tr, label, money, productName, localeTag } = useI18n();
    return (<Guard>
      <ProfileForm />
    </Guard>);
}
function ProfileForm() {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const client = useQueryClient();
    const toast = useToast();
    const [draft, setDraft] = useState<Profile>();
    const profile = useQuery({
        queryKey: [user.data?.id, "profile"],
        queryFn: () => api<Profile>("/users/me/profile").then((r) => r.data),
    });
    const taxonomy = useQuery({
        queryKey: [user.data?.id, "taxonomy"],
        queryFn: () => api<Taxonomy>("/taxonomy").then((r) => r.data),
    });
    const value = draft || profile.data;
    const save = useMutation({
        mutationFn: () => api<Profile>("/users/me/profile", { method: "PUT", body: json(value) }),
        onSuccess: () => {
            client.invalidateQueries({ queryKey: [user.data?.id, "profile"] });
            client.invalidateQueries({ queryKey: ["session"] });
            toast(tr("\u0110\u00E3 l\u01B0u phong c\u00E1ch c\u1EE7a b\u1EA1n."));
        },
    });
    function update(patch: Partial<Profile>) {
        if (value)
            setDraft({ ...value, ...patch });
    }
    return (<div className="container page narrow">
      <PageIntro eyebrow={tr("THE DETAILS THAT MAKE YOU, YOU")} title={tr("Phong c\u00E1ch c\u1EE7a b\u1EA1n.")} description={tr("M\u1ED9t v\u00E0i s\u1EDF th\u00EDch gi\u00FAp ch\u00FAng t\u00F4i b\u1EAFt \u0111\u1EA7u \u0111\u00FAng h\u01B0\u1EDBng. B\u1EA1n lu\u00F4n c\u00F3 th\u1EC3 thay \u0111\u1ED5i khi ph\u1ED1i Look.")}/>
      <ErrorBox error={profile.error || taxonomy.error}/>
      {value && taxonomy.data && (<form className="profile-form" onSubmit={(e) => {
                e.preventDefault();
                save.mutate();
            }}>
          <label>{tr("T\u00EAn hi\u1EC3n th\u1ECB")}<input required maxLength={80} value={value.display_name} onChange={(e) => update({ display_name: e.target.value })}/>
          </label>
          <label>{tr("Gender (kh\u00F4ng b\u1EAFt bu\u1ED9c)")}<select value={value.gender || ""} onChange={(e) => update({ gender: e.target.value || null })}>
              <option value="">{tr("Kh\u00F4ng gi\u1EDBi h\u1EA1n")}</option>
              <option value="FEMALE">{tr("N\u1EEF")}</option>
              <option value="MALE">{tr("Nam")}</option>
              <option value="UNISEX">{tr("Unisex")}</option>
            </select>
          </label>
          <div className="form-section">
            <h3>{tr("Phong c\u00E1ch y\u00EAu th\u00EDch")}</h3>
            <Chips multiple items={taxonomy.data.styles} selected={value.preferred_styles} onSelect={(v) => update({ preferred_styles: v })}/>
          </div>
          <div className="form-section">
            <h3>{tr("M\u00E0u s\u1EAFc y\u00EAu th\u00EDch")}</h3>
            <Colors taxonomy={taxonomy.data} selected={value.favorite_colors} onSelect={(v) => update({ favorite_colors: v })}/>
          </div>
          <div className="field-row">
            <label>{tr("Ng\u00E2n s\u00E1ch t\u1EEB (VND)")}<input type="number" min={0} value={value.budget_min_vnd ?? ""} onChange={(e) => update({
                budget_min_vnd: e.target.value
                    ? Number(e.target.value)
                    : null,
            })}/>
            </label>
            <label>{tr("Ng\u00E2n s\u00E1ch \u0111\u1EBFn (VND)")}<input type="number" min={1} value={value.budget_max_vnd ?? ""} onChange={(e) => update({
                budget_max_vnd: e.target.value
                    ? Number(e.target.value)
                    : null,
            })}/>
            </label>
          </div>
          <ErrorBox error={save.error}/>
          <button className="button" disabled={save.isPending}>
            {save.isPending ? tr("\u0110ang l\u01B0u\u2026") : tr("L\u01B0u s\u1EDF th\u00EDch")}
            <ArrowRight size={16}/>
          </button>
        </form>)}
    </div>);
}
