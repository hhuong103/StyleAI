"use client";
import { useI18n } from "@/components/locale-provider";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Check,
  LoaderCircle,
  Rotate3D,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, idempotency, json } from "@/lib/api";
import type {
  Context,
  Plan,
  Product,
  Profile,
  Recommendation,
  Taxonomy,
} from "@/lib/types";
import { Guard, useToast, useUser, useWaitlist } from "./providers";
import { ErrorBox, PageIntro } from "./ui";
export function Chips({
  items,
  selected,
  onSelect,
  multiple = false,
}: {
  items: {
    code: string;
    label: string;
  }[];
  selected: string[];
  onSelect: (value: string[]) => void;
  multiple?: boolean;
}) {
  const { tr, label, money, productName, localeTag } = useI18n();
  return (
    <div className="chips">
      {items.map((item) => (
        <button
          type="button"
          className={`chip ${selected.includes(item.code) ? "selected" : ""}`}
          key={item.code}
          aria-pressed={selected.includes(item.code)}
          onClick={() =>
            onSelect(
              multiple
                ? selected.includes(item.code)
                  ? selected.filter((c) => c !== item.code)
                  : [...selected, item.code]
                : [item.code],
            )
          }
        >
          {label(item.code, item.label)}
          {selected.includes(item.code) && <Check size={13} />}
        </button>
      ))}
    </div>
  );
}
export function Colors({
  taxonomy,
  selected,
  onSelect,
}: {
  taxonomy: Taxonomy;
  selected: string[];
  onSelect: (value: string[]) => void;
}) {
  const { tr, label, money, productName, localeTag } = useI18n();
  return (
    <div className="swatches">
      {taxonomy.colors.map((c) => (
        <button
          type="button"
          key={c.code}
          aria-label={label(c.code, c.label)}
          title={label(c.code, c.label)}
          aria-pressed={selected.includes(c.code)}
          className={`swatch ${selected.includes(c.code) ? "selected" : ""}`}
          style={{ "--swatch": c.hex } as React.CSSProperties}
          onClick={() =>
            onSelect(
              selected.includes(c.code)
                ? selected.filter((s) => s !== c.code)
                : [...selected, c.code],
            )
          }
        >
          <span />
          {selected.includes(c.code) && <Check size={16} />}
        </button>
      ))}
      <button
        type="button"
        className="text-button"
        onClick={() => onSelect([])}
      >
        {tr("Kh\u00F4ng \u01B0u ti\u00EAn")}
      </button>
    </div>
  );
}

type TryOnResult = {
  request_id: string;
  views: { view: "LEFT" | "FRONT" | "RIGHT"; url: string }[];
  background: string;
  product_ids: string[];
  disclaimer: string;
};

const tryOnBackgrounds = [
  "SCHOOL",
  "CAFE",
  "PARTY",
  "TRAVEL",
  "OFFICE",
  "STUDIO",
] as const;

function VirtualTryOnStudio({ products }: { products: Product[] }) {
  const { tr, productName } = useI18n();
  const [viewIndex, setViewIndex] = useState(1);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [form, setForm] = useState({
    gender: "FEMALE",
    age: "24",
    height_cm: "165",
    weight_kg: "52",
    bust_cm: "",
    waist_cm: "",
    hips_cm: "",
    background: "CAFE",
    consent_external_processing: false,
  });
  const mutation = useMutation({
    mutationFn: () =>
      api<TryOnResult>("/stylist/virtual-try-on", {
        method: "POST",
        body: json({
          selected_products: products.map((product) => product.id),
          gender: form.gender,
          age: Number(form.age),
          height_cm: Number(form.height_cm),
          weight_kg: Number(form.weight_kg),
          bust_cm: form.bust_cm ? Number(form.bust_cm) : null,
          waist_cm: form.waist_cm ? Number(form.waist_cm) : null,
          hips_cm: form.hips_cm ? Number(form.hips_cm) : null,
          background: form.background,
          consent_external_processing: form.consent_external_processing,
        }),
      }).then((response) => response.data),
    onSuccess: () => setViewIndex(1),
  });
  const result = mutation.data;
  const activeView = result?.views[viewIndex];
  const generationError =
    mutation.error instanceof ApiError
      ? (() => {
          const providerMessage = mutation.error.details.provider_message;
          const invalidApiKey =
            mutation.error.code === "AI_IMAGE_CONFIGURATION" &&
            typeof providerMessage === "string" &&
            /api key (not valid|is invalid)/iu.test(providerMessage);
          const permissionDenied =
            mutation.error.code === "AI_IMAGE_CONFIGURATION" &&
            mutation.error.details.provider_code === "PERMISSION_DENIED";
          const messages: Record<string, string> = {
            GEMINI_IMAGE_NOT_CONFIGURED: tr(
              "Gemini image generation is not configured. Add GEMINI_API_KEY to your environment and restart the API.",
            ),
            AI_IMAGE_CONFIGURATION: tr(
              permissionDenied
                ? "Gemini denied access to the API service. Enable the Generative Language API and check API key restrictions."
                : invalidApiKey
                  ? "The Gemini API key is invalid. Create a new key in Google AI Studio, update GEMINI_API_KEY, and restart the API."
                  : "Gemini rejected the API key or image model access. Check the API key and enabled model.",
            ),
            AI_IMAGE_MODEL_UNAVAILABLE: tr(
              "The configured Gemini image model is unavailable for this API key.",
            ),
            AI_IMAGE_QUOTA_EXCEEDED: tr(
              "Gemini image generation quota is exhausted. Check the project quota and billing.",
            ),
            AI_IMAGE_FAILED: tr("Gemini refused the image generation request."),
          };
          const message =
            messages[mutation.error.code] || mutation.error.message;
          const providerStatus = mutation.error.details.provider_status;
          const providerCode = mutation.error.details.provider_code;
          const diagnostic = [
            typeof providerStatus === "number" ? `HTTP ${providerStatus}` : "",
            typeof providerCode === "string" ? providerCode : "",
            typeof providerMessage === "string" ? providerMessage : "",
          ]
            .filter(Boolean)
            .join(" · ");
          return new Error(
            diagnostic
              ? `${message} ${tr("Provider response: {0}", { "0": diagnostic })}`
              : message,
          );
        })()
      : mutation.error;
  const patch = (key: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    mutation.reset();
  };
  const rotate = (direction: -1 | 1) => {
    if (!result) return;
    setViewIndex((current) =>
      Math.min(result.views.length - 1, Math.max(0, current + direction)),
    );
  };
  return (
    <section className="try-on-studio" aria-labelledby="try-on-title">
      <div className="try-on-heading">
        <div>
          <h2 id="try-on-title">{tr("Create your AI try-on")}</h2>
          <p>
            {tr(
              "Add your measurements and choose a setting. Your selected pieces stay at the centre of every generated view.",
            )}
          </p>
        </div>
        <span>{tr("{0} selected pieces", { "0": products.length })}</span>
      </div>

      <div className="try-on-layout">
        <form
          className="try-on-form"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="try-on-products" aria-label={tr("Selected outfit")}>
            {products.map((product) => (
              <div key={product.id}>
                {product.image && (
                  <img
                    src={product.image.url}
                    alt={product.image.alt_text || productName(product)}
                  />
                )}
                <span>{productName(product)}</span>
              </div>
            ))}
          </div>

          <fieldset>
            <legend>{tr("Model profile")}</legend>
            <div className="try-on-fields">
              <label>
                {tr("Gender")}
                <select
                  value={form.gender}
                  onChange={(event) => patch("gender", event.target.value)}
                >
                  <option value="FEMALE">{tr("Female")}</option>
                  <option value="MALE">{tr("Male")}</option>
                  <option value="UNISEX">{tr("Gender-neutral")}</option>
                </select>
              </label>
              <TryOnNumber
                label={tr("Age")}
                value={form.age}
                min={18}
                max={80}
                suffix={tr("years")}
                onChange={(value) => patch("age", value)}
              />
              <TryOnNumber
                label={tr("Height")}
                value={form.height_cm}
                min={130}
                max={220}
                suffix="cm"
                onChange={(value) => patch("height_cm", value)}
              />
              <TryOnNumber
                label={tr("Weight")}
                value={form.weight_kg}
                min={35}
                max={200}
                suffix="kg"
                onChange={(value) => patch("weight_kg", value)}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>
              {tr("Body measurements")}
              <span>{tr("Optional")}</span>
            </legend>
            <div className="try-on-fields three">
              <TryOnNumber
                label={tr("Bust")}
                value={form.bust_cm}
                min={50}
                max={180}
                suffix="cm"
                required={false}
                onChange={(value) => patch("bust_cm", value)}
              />
              <TryOnNumber
                label={tr("Waist")}
                value={form.waist_cm}
                min={45}
                max={180}
                suffix="cm"
                required={false}
                onChange={(value) => patch("waist_cm", value)}
              />
              <TryOnNumber
                label={tr("Hips")}
                value={form.hips_cm}
                min={50}
                max={200}
                suffix="cm"
                required={false}
                onChange={(value) => patch("hips_cm", value)}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>{tr("Choose a setting")}</legend>
            <div className="try-on-backgrounds">
              {tryOnBackgrounds.map((background) => (
                <button
                  type="button"
                  key={background}
                  className={form.background === background ? "selected" : ""}
                  aria-pressed={form.background === background}
                  onClick={() => patch("background", background)}
                >
                  {tr(background)}
                  {form.background === background && <Check size={15} />}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="try-on-consent">
            <input
              type="checkbox"
              required
              checked={form.consent_external_processing}
              onChange={(event) =>
                patch("consent_external_processing", event.target.checked)
              }
            />
            <span>
              {tr(
                "I agree that these measurements and product references may be sent to the image generation provider. Measurements are not stored in my profile.",
              )}
            </span>
          </label>

          <ErrorBox error={generationError} />
          <button
            type="submit"
            className="button accent full"
            disabled={mutation.isPending || products.length === 0}
          >
            {mutation.isPending ? (
              <>
                <LoaderCircle className="spin" size={18} />
                {tr("Generating three views…")}
              </>
            ) : (
              <>
                <WandSparkles size={18} />
                {tr("Generate AI try-on")}
              </>
            )}
          </button>
          <p className="try-on-note">
            {tr(
              "AI previews can vary in fit and small garment details. Use them as a styling reference, not an exact sizing guarantee.",
            )}
          </p>
        </form>

        <div className={`try-on-viewer ${result ? "has-result" : ""}`}>
          {activeView ? (
            <>
              <div
                className="try-on-stage"
                onPointerDown={(event) => setDragStart(event.clientX)}
                onPointerUp={(event) => {
                  if (dragStart === null) return;
                  const distance = event.clientX - dragStart;
                  if (Math.abs(distance) > 35) rotate(distance > 0 ? -1 : 1);
                  setDragStart(null);
                }}
              >
                <img
                  key={activeView.url}
                  src={activeView.url}
                  alt={tr("AI-generated {0} view of the selected outfit", {
                    "0": tr(activeView.view).toLowerCase(),
                  })}
                />
                <span>{tr(activeView.view)}</span>
              </div>
              <div className="try-on-rotate">
                <button
                  type="button"
                  aria-label={tr("Rotate model left")}
                  disabled={viewIndex === 0}
                  onClick={() => rotate(-1)}
                >
                  <ChevronLeft size={20} />
                </button>
                <div>
                  <Rotate3D size={18} />
                  <span>{tr("Drag or use arrows to rotate")}</span>
                </div>
                <button
                  type="button"
                  aria-label={tr("Rotate model right")}
                  disabled={viewIndex === result.views.length - 1}
                  onClick={() => rotate(1)}
                >
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="try-on-thumbnails">
                {result.views.map((view, index) => (
                  <button
                    type="button"
                    key={view.url}
                    className={index === viewIndex ? "selected" : ""}
                    aria-label={tr("Show {0} view", {
                      "0": tr(view.view).toLowerCase(),
                    })}
                    aria-pressed={index === viewIndex}
                    onClick={() => setViewIndex(index)}
                  >
                    <img src={view.url} alt="" />
                    <span>{tr(view.view)}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="try-on-empty">
              {mutation.isPending ? (
                <LoaderCircle className="spin" size={36} />
              ) : (
                <Rotate3D size={40} />
              )}
              <h3>
                {mutation.isPending
                  ? tr("Building your multi-angle preview")
                  : tr("Your model will appear here")}
              </h3>
              <p>
                {mutation.isPending
                  ? tr(
                      "The AI is preserving your selected garments while creating three consistent camera angles.",
                    )
                  : tr(
                      "Complete the profile and setting, then generate a left, front and right view.",
                    )}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TryOnNumber({
  label,
  value,
  min,
  max,
  suffix,
  required = true,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  max: number;
  suffix: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <span className="try-on-number">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span>{suffix}</span>
      </span>
    </label>
  );
}
export function StylistScreen() {
  const { tr, label, money, productName, localeTag } = useI18n();
  return (
    <Guard>
      <Stylist />
    </Guard>
  );
}
function Stylist() {
  const { tr, label, productName, localeTag } = useI18n();
  const user = useUser();
  const waitlist = useWaitlist();
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
    budget_max_vnd: 100000000,
  });
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const waitlistQueries = useQueries({
    queries: waitlist.items.map((item) => ({
      queryKey: [user.data?.id, "product", item.product_id],
      queryFn: () =>
        api<Product>(`/products/${item.product_id}`).then((r) => r.data),
      enabled: waitlist.ready,
    })),
  });
  const waitlistRows = waitlist.items.map((entry, index) => ({
    entry,
    query: waitlistQueries[index],
  }));
  const selectedEntries = waitlist.items.filter((item) =>
    selectedProductIds.includes(item.product_id),
  );
  const selectedProducts = waitlistRows.flatMap(({ entry, query }) =>
    selectedProductIds.includes(entry.product_id) && query.data
      ? [query.data]
      : [],
  );
  const roleForProduct = (productId: string) => {
    const product = waitlistRows.find(
      (row) => row.entry.product_id === productId,
    )?.query.data;
    return taxonomy.data?.categories.find(
      (category) => category.code === product?.category,
    )?.item_role;
  };
  useEffect(() => {
    setSelectedProductIds((ids) =>
      ids.filter((id) => waitlist.items.some((item) => item.product_id === id)),
    );
  }, [waitlist.items]);
  const initialized = useRef(false);
  useEffect(() => {
    if (profile.data && !initialized.current) {
      initialized.current = true;
      setContext((c) => ({
        ...c,
        gender: profile.data.gender,
        style: profile.data.preferred_styles[0] || "CASUAL",
        preferred_colors: profile.data.favorite_colors,
        budget_max_vnd: 100000000,
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
        const p = (
          await api<Plan>("/stylist/plan", {
            method: "POST",
            body: json({ text, context }),
          })
        ).data;
        setContext(p.normalized_context);
        setPlan(p);
        setParsed(true);
        setPhase("");
        toast(
          tr(
            "\u0110\u00E3 hi\u1EC3u m\u00F4 t\u1EA3. Ki\u1EC3m tra c\u00E1c l\u1EF1a ch\u1ECDn b\u00EAn d\u01B0\u1EDBi r\u1ED3i t\u1EA1o Look.",
          ),
        );
        return;
      }
      const p = (
        await api<Plan>("/stylist/plan", {
          method: "POST",
          body: json({ text, context }),
        })
      ).data;
      setPlan(p);
      if (p.needs_confirmation.length) {
        setPhase("");
        return;
      }
      setPhase("recommend");
      const rec = (
        await api<Recommendation>("/recommendations", {
          method: "POST",
          body: json({
            plan_id: p.plan_id,
            top_k: 5,
            selected_products: selectedEntries,
          }),
          headers: idempotency(),
        })
      ).data;
      router.push(`/recommendations/${rec.recommendation_id}`);
    },
    onError: () => setPhase(""),
  });
  return (
    <div className="container page stylist-page">
      <PageIntro
        eyebrow={tr("YOUR NEXT CHAPTER, STYLED")}
        title={tr("H\u00F4m nay, b\u1EA1n mu\u1ED1n l\u00E0 ai?")}
        description={tr(
          "K\u1EC3 m\u1ED9t ch\u00FAt v\u1EC1 k\u1EBF ho\u1EA1ch c\u1EE7a b\u1EA1n. Ch\u00FAng t\u00F4i s\u1EBD ph\u1ED1i nh\u1EEFng m\u00F3n \u0111\u1ED3 th\u00E0nh m\u1ED9t Look c\u00F3 l\u00FD do.",
        )}
      />
      <section className="waitlist-section" id="waitlist">
        <div className="waitlist-heading">
          <div>
            <p className="eyebrow">
              {tr("Waitlist")} · {waitlist.items.length}
            </p>
            <h2>{tr("Your Waitlist")}</h2>
            <p>
              {tr(
                "Add pieces from the catalog, then select the ones you want AI Stylist to use.",
              )}
            </p>
          </div>
          <Link className="button outline small" href="/catalog">
            {tr("B\u1ED9 s\u01B0u t\u1EADp")}
            <ArrowRight size={15} />
          </Link>
        </div>
        {waitlist.items.length === 0 ? (
          <p className="waitlist-empty">
            {tr("No items in your Waitlist yet.")}
          </p>
        ) : (
          <div className="waitlist-items">
            {waitlistRows.map(({ entry, query }) => {
              const product = query.data;
              const variant = product?.variants.find(
                (item) => item.id === entry.variant_id,
              );
              const role =
                product &&
                taxonomy.data?.categories.find(
                  (category) => category.code === product.category,
                )?.item_role;
              const roleAlreadySelected =
                role &&
                selectedProductIds.some(
                  (id) =>
                    id !== entry.product_id && roleForProduct(id) === role,
                );
              const selectable = Boolean(
                product &&
                  role &&
                  product.active &&
                  variant?.available &&
                  !roleAlreadySelected,
              );
              const checked = selectedProductIds.includes(entry.product_id);
              return (
                <div className="waitlist-item" key={entry.product_id}>
                  <input
                    type="checkbox"
                    aria-label={
                      product
                        ? tr("Select {0} for styling", {
                            "0": productName(product),
                          })
                        : tr("Select items for AI styling")
                    }
                    checked={checked}
                    disabled={!selectable && !checked}
                    onChange={(event) => {
                      if (event.target.checked) {
                        if (roleAlreadySelected) {
                          toast(
                            tr(
                              "Select no more than one item per clothing type.",
                            ),
                          );
                          return;
                        }
                        setSelectedProductIds((ids) => [
                          ...ids,
                          entry.product_id,
                        ]);
                      } else {
                        setSelectedProductIds((ids) =>
                          ids.filter((id) => id !== entry.product_id),
                        );
                      }
                    }}
                  />
                  {product?.image && (
                    <img
                      src={product.image.url}
                      alt={product.image.alt_text || productName(product)}
                    />
                  )}
                  <div className="waitlist-item-copy">
                    {query.isPending ? (
                      <span>{tr("\u0110ang t\u1EA3i\u2026")}</span>
                    ) : product ? (
                      <>
                        <strong>{productName(product)}</strong>
                        <span>
                          {product.brand} ·{" "}
                          {variant?.size_code || tr("Thông tin size chưa có")}
                        </span>
                        {!selectable && (
                          <span className="waitlist-unavailable">
                            {tr(" \u00B7 H\u1EBFt h\u00E0ng")}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="waitlist-unavailable">
                        {query.error instanceof Error
                          ? query.error.message
                          : tr("Sản phẩm không còn khả dụng.")}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={tr("Remove {0} from Waitlist", {
                      "0": product ? productName(product) : entry.product_id,
                    })}
                    onClick={() => {
                      waitlist.remove(entry.product_id);
                      toast(
                        tr("Removed {0} from your Waitlist.", {
                          "0": product
                            ? productName(product)
                            : entry.product_id,
                        }),
                      );
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {waitlist.items.length > 0 && (
          <p className="waitlist-selection">
            {tr("{0} selected", { "0": selectedEntries.length })} ·{" "}
            {tr("Select no more than one item per clothing type.")}
          </p>
        )}
      </section>
      {selectedProducts.length > 0 && (
        <VirtualTryOnStudio products={selectedProducts} />
      )}
      <div className="stylist-layout">
        <section className="stylist-form">
          <div className="prompt-box">
            <div className="prompt-heading">
              <Sparkles size={19} />
              <span>
                {tr("G\u1EECI M\u1ED8T L\u1EDCI NH\u1EAEN CHO STYLIST")}
              </span>
            </div>
            <textarea
              aria-label={tr(
                "M\u00F4 t\u1EA3 nhu c\u1EA7u ph\u1ED1i \u0111\u1ED3",
              )}
              maxLength={2000}
              placeholder={tr(
                "Tôi cần một outfit tối giản cho buổi phỏng vấn…",
              )}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setParsed(false);
              }}
            />
            <p>
              {text.length}/2000{" "}
              <span>
                {tr(
                  "M\u00F4 t\u1EA3 nhu c\u1EA7u ho\u1EB7c ch\u1ECDn tr\u1EF1c ti\u1EBFp b\u00EAn d\u01B0\u1EDBi.",
                )}
              </span>
            </p>
          </div>
          {plan && (
            <div className="understood">
              <Check size={18} />
              <span>
                {tr("\u0110\u00E3 hi\u1EC3u:") + " "}
                {label(plan.normalized_context.occasion)} ·{" "}
                {label(plan.normalized_context.style)}
              </span>
            </div>
          )}
          {taxonomy.data && (
            <>
              <div className="form-section">
                <h3>
                  <span>01</span>
                  {tr("B\u1EA1n s\u1EBD \u0111i \u0111\u00E2u?")}
                </h3>
                <Chips
                  items={taxonomy.data.occasions}
                  selected={[context.occasion]}
                  onSelect={(v) => patch({ occasion: v[0] })}
                />
              </div>
              <div className="form-section">
                <h3>
                  <span>02</span>
                  {tr("M\u1ED9t ch\u00FAt phong c\u00E1ch c\u1EE7a b\u1EA1n")}
                </h3>
                <Chips
                  items={taxonomy.data.styles}
                  selected={[context.style]}
                  onSelect={(v) => patch({ style: v[0] })}
                />
              </div>
              <div className="form-section">
                <h3>
                  <span>03</span>
                  {tr("M\u00E0u s\u1EAFc b\u1EA1n mu\u1ED1n di\u1EC7n")}
                </h3>
                <Colors
                  taxonomy={taxonomy.data}
                  selected={context.preferred_colors}
                  onSelect={(v) => patch({ preferred_colors: v })}
                />
              </div>
            </>
          )}
          <div className="form-section">
            <h3>
              <span>04</span>
              {tr("Phom dáng dành cho bạn")}
            </h3>
            <label>
              {tr("Gender / ng\u1EEF c\u1EA3nh")}
              <select
                value={context.gender || ""}
                onChange={(e) => patch({ gender: e.target.value || null })}
              >
                <option value="">{tr("Kh\u00F4ng gi\u1EDBi h\u1EA1n")}</option>
                <option value="FEMALE">{tr("N\u1EEF")}</option>
                <option value="MALE">{tr("Nam")}</option>
                <option value="UNISEX">{tr("Unisex")}</option>
              </select>
            </label>
          </div>
          <ErrorBox error={mutation.error || taxonomy.error} />
          <button
            className="button full accent"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <>
                <LoaderCircle className="spin" size={18} />
                {tr("\u0110ang chu\u1EA9n b\u1ECB Look\u2026")}
              </>
            ) : (
              <>
                {text.trim() && !parsed
                  ? tr("Hi\u1EC3u y\u00EAu c\u1EA7u c\u1EE7a t\u00F4i")
                  : selectedEntries.length
                    ? tr("Style selected items")
                    : tr("T\u1EA1o Look d\u00E0nh cho t\u00F4i")}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="fine-print">
            {tr(
              "Gợi ý được tạo từ kiểu dáng, màu sắc và hoàn cảnh bạn đã chọn.",
            )}
          </p>
        </section>
        <aside className="stylist-aside">
          <img
            src="/editorial.svg"
            alt={tr("Minh h\u1ECDa b\u1ED9 trang ph\u1EE5c trung t\u00EDnh")}
          />
          <p className="eyebrow">{tr("THOUGHTFULLY PUT TOGETHER.")}</p>
          <h2>
            {tr("M\u1ED7i m\u00F3n \u0111\u1ED3,")}
            <br />
            <em>{tr("m\u1ED9t l\u00FD do.")}</em>
          </h2>
          <p>
            {tr(
              "Hợp hoàn cảnh. Đúng tinh thần. Và luôn có chỗ cho lựa chọn của bạn.",
            )}
          </p>
          {mutation.isPending && (
            <div className="processing" role="status" aria-live="polite">
              <p>
                {phase === "plan" ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <Check size={17} />
                )}
                {tr("\u0110ang hi\u1EC3u nhu c\u1EA7u c\u1EE7a b\u1EA1n")}
              </p>
              {phase === "recommend" && (
                <>
                  <p>
                    <Check size={17} />
                    {tr(
                      "\u0110\u00E3 t\u1EA1o c\u1EA5u tr\u00FAc trang ph\u1EE5c",
                    )}
                  </p>
                  <p>
                    <LoaderCircle className="spin" size={17} />
                    {tr("Đang tìm và ghép Look phù hợp")}
                  </p>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
export function ProfileScreen() {
  const { tr, label, money, productName, localeTag } = useI18n();
  return (
    <Guard>
      <ProfileForm />
    </Guard>
  );
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
    mutationFn: () =>
      api<Profile>("/users/me/profile", { method: "PUT", body: json(value) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [user.data?.id, "profile"] });
      client.invalidateQueries({ queryKey: ["session"] });
      toast(tr("\u0110\u00E3 l\u01B0u phong c\u00E1ch c\u1EE7a b\u1EA1n."));
    },
  });
  function update(patch: Partial<Profile>) {
    if (value) setDraft({ ...value, ...patch });
  }
  return (
    <div className="container page narrow">
      <PageIntro
        eyebrow={tr("THE DETAILS THAT MAKE YOU, YOU")}
        title={tr("Phong c\u00E1ch c\u1EE7a b\u1EA1n.")}
        description={tr(
          "M\u1ED9t v\u00E0i s\u1EDF th\u00EDch gi\u00FAp ch\u00FAng t\u00F4i b\u1EAFt \u0111\u1EA7u \u0111\u00FAng h\u01B0\u1EDBng. B\u1EA1n lu\u00F4n c\u00F3 th\u1EC3 thay \u0111\u1ED5i khi ph\u1ED1i Look.",
        )}
      />
      <ErrorBox error={profile.error || taxonomy.error} />
      {value && taxonomy.data && (
        <form
          className="profile-form"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label>
            {tr("T\u00EAn hi\u1EC3n th\u1ECB")}
            <input
              required
              maxLength={80}
              value={value.display_name}
              onChange={(e) => update({ display_name: e.target.value })}
            />
          </label>
          <label>
            {tr("Gender (kh\u00F4ng b\u1EAFt bu\u1ED9c)")}
            <select
              value={value.gender || ""}
              onChange={(e) => update({ gender: e.target.value || null })}
            >
              <option value="">{tr("Kh\u00F4ng gi\u1EDBi h\u1EA1n")}</option>
              <option value="FEMALE">{tr("N\u1EEF")}</option>
              <option value="MALE">{tr("Nam")}</option>
              <option value="UNISEX">{tr("Unisex")}</option>
            </select>
          </label>
          <div className="form-section">
            <h3>{tr("Phong c\u00E1ch y\u00EAu th\u00EDch")}</h3>
            <Chips
              multiple
              items={taxonomy.data.styles}
              selected={value.preferred_styles}
              onSelect={(v) => update({ preferred_styles: v })}
            />
          </div>
          <div className="form-section">
            <h3>{tr("M\u00E0u s\u1EAFc y\u00EAu th\u00EDch")}</h3>
            <Colors
              taxonomy={taxonomy.data}
              selected={value.favorite_colors}
              onSelect={(v) => update({ favorite_colors: v })}
            />
          </div>
          <ErrorBox error={save.error} />
          <button className="button" disabled={save.isPending}>
            {save.isPending
              ? tr("\u0110ang l\u01B0u\u2026")
              : tr("L\u01B0u s\u1EDF th\u00EDch")}
            <ArrowRight size={16} />
          </button>
        </form>
      )}
    </div>
  );
}
