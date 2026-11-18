"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  Check,
  Cloud,
  Dice5,
  Grid2X2,
  Heart,
  Menu,
  Moon,
  MoreHorizontal,
  Redo2,
  RotateCcw,
  Save,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Undo2,
  X,
  Smile,
  Scissors,
  Brush,
  PersonStanding,
  Globe,
  Flower2,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, useId, type CSSProperties } from "react";
import { api, idempotency, json } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useToast, useUser } from "./providers";
import { illustrativeShopping, type ShoppingTarget } from "@/lib/vell-shopping";
import { VellShoppingOverlay } from "./vell-shopping-overlay";

type Category = {
  id: string;
  label: string;
  occasion: string;
  style: string;
  icon: LucideIcon;
};
type DemoItem = { name: string; group: string };
type DemoLook = {
  modelName?: string;
  id: string;
  title: string;
  image: string;
  categories: string[];
  items: DemoItem[];
};
type Model = {
  model_id: string;
  name: string;
  presentation: string;
  full_body_image_url: string;
  portrait_url: string;
};
type Session = {
  session_id: string;
  model_id: string;
  version: number;
  outfit_id: string | null;
};
type Garment = {
  garment_id: string;
  slot: string;
  product: Product & { verification_status: string };
};
type Outfit = { outfit_id: string; name: string; garments: Garment[] };
type Result = {
  views: { view: string; url: string }[];
  model_id: string;
  outfit_id: string;
  quality_status: string;
};
type Job = {
  id: string;
  status: string;
  result: Result | null;
  error: { message: string } | null;
};
type Region = {
  region_id: string;
  product_name: string;
  retailer_name: string;
  layer_priority: number;
  verified_product_url: string;
  polygon: [number, number][];
  valid_until: string;
};
type History = { selection: string; category: string; filter: string };
const categories: Category[] = [
  {
    id: "all",
    label: "All",
    occasion: "DAILY",
    style: "CASUAL",
    icon: Grid2X2,
  },
  {
    id: "everyday",
    label: "Everyday",
    occasion: "DAILY",
    style: "CASUAL",
    icon: Shirt,
  },
  {
    id: "athletic",
    label: "Athletic",
    occasion: "ATHLETIC",
    style: "SPORTY",
    icon: SlidersHorizontal,
  },
  {
    id: "sleep",
    label: "Sleep",
    occasion: "SLEEP",
    style: "CASUAL",
    icon: Moon,
  },
  {
    id: "formal",
    label: "Formal",
    occasion: "OFFICE",
    style: "FORMAL",
    icon: PersonStanding,
  },
  {
    id: "party",
    label: "Party",
    occasion: "PARTY",
    style: "FORMAL",
    icon: Sparkles,
  },
  {
    id: "street",
    label: "Street",
    occasion: "STREET",
    style: "STREETWEAR",
    icon: ShoppingBag,
  },
];
const item = (name: string, group: string): DemoItem => ({ name, group });
const hanLooks: DemoLook[] = [
  {
    id: "denim",
    title: "City denim",
    image: "/images/vell-outfits/denim.png",
    categories: ["everyday", "street"],
    items: [
      item("Black sleeveless top", "TOPS"),
      item("Denim midi skirt", "BOTTOMS"),
      item("Black boots", "SHOES"),
    ],
  },
  {
    id: "cream",
    title: "Soft ivory",
    image: "/images/vell-outfits/cream.png",
    categories: ["everyday"],
    items: [
      item("Ivory blouse", "TOPS"),
      item("Ivory trousers", "BOTTOMS"),
      item("Neutral shoes", "SHOES"),
    ],
  },
  {
    id: "grey",
    title: "Everyday ease",
    image: "/images/vell-outfits/grey.png",
    categories: ["everyday", "athletic"],
    items: [
      item("White long-sleeved top", "TOPS"),
      item("Grey trousers", "BOTTOMS"),
      item("Neutral shoes", "SHOES"),
    ],
  },
  {
    id: "lavender",
    title: "Lavender tailoring",
    image: "/images/vell-outfits/lavender.png",
    categories: ["formal", "party"],
    items: [
      item("Lavender blazer", "TOPS"),
      item("White top", "TOPS"),
      item("Lavender trousers", "BOTTOMS"),
      item("White shoes", "SHOES"),
    ],
  },
  {
    id: "blue",
    title: "Blue lounge",
    image: "/images/vell-outfits/blue.png",
    categories: ["sleep"],
    items: [
      item("Satin pajama shirt", "TOPS"),
      item("Satin pajama trousers", "BOTTOMS"),
      item("Slippers", "SHOES"),
    ],
  },
  {
    id: "formal",
    title: "Black tailoring",
    image: "/images/vell-outfits/formal.png",
    categories: ["formal"],
    items: [
      item("Black blazer", "TOPS"),
      item("White top", "TOPS"),
      item("Black trousers", "BOTTOMS"),
      item("Black shoes", "SHOES"),
    ],
  },
  {
    id: "sage",
    title: "Sage satin",
    image: "/images/vell-outfits/sage.png",
    categories: ["party", "formal"],
    items: [
      item("Sage satin dress", "FULL BODY"),
      item("Neutral shoes", "SHOES"),
    ],
  },
  {
    id: "street",
    title: "Casual streetwear",
    image: "/images/vell-model.png",
    categories: ["everyday", "street"],
    items: [
      item("Black leather bomber", "TOPS"),
      item("White cropped T-shirt", "TOPS"),
      item("Olive cargo trousers", "BOTTOMS"),
      item("Black boots", "SHOES"),
    ],
  },
];
const modelSlugs: Record<string, string> = {
  Alex: "alex",
  Minh: "minh",
  Marcus: "marcus",
  Linh: "linh",
  Amara: "amara",
  Sofia: "sofia",
  "VELL Utility": "male",
};
const outfitGroups = [
  "everyday",
  "athletic",
  "sleep",
  "formal",
  "party",
  "street",
];
const extraLooks: DemoLook[] = Object.entries(modelSlugs).flatMap(
  ([name, slug]) =>
    outfitGroups.map((group) => ({
      id: `${slug}-${group}`,
      title: `${name} · ${group[0].toUpperCase()}${group.slice(1)}`,
      modelName: name,
      image: `/images/vell-outfits/models/${slug}-${group}.svg`,
      categories: [group],
      items: [],
    })),
);
const allLooks = [...hanLooks, ...extraLooks];
const message = (cause: unknown) =>
  cause instanceof Error
    ? cause.message
    : "Không thể hoàn tất yêu cầu. Vui lòng thử lại.";

export function VellStudio() {
  const toast = useToast();
  const user = useUser();
  const [category, setCategory] = useState("all");
  const [selection, setSelection] = useState("street");
  const [mode, setMode] = useState<"demo" | "live">("demo");
  const [filter, setFilter] = useState("Cool Studio");
  const [realism, setRealism] = useState(75);
  const [zoom, setZoom] = useState(100);

  const stageRef = useRef<HTMLElement>(null);

  const [, setSection] = useState("Outfits");
  const [panel, setPanel] = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState<Model | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionsFor, setRegionsFor] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [serverSaved, setServerSaved] = useState<
    { saved_look_id: string; name: string; result_id: string }[]
  >([]);
  const [bag, setBag] = useState<
    { id: string; product: Product & { verification_status: string } }[]
  >([]);
  const [history, setHistory] = useState<History[]>([]);
  const [future, setFuture] = useState<History[]>([]);
  const requestVersion = useRef(0);
  const looks =
    model && model.name !== "Han Seo-yeon"
      ? extraLooks.filter((look) => look.modelName === model.name)
      : hanLooks;
  const currentDemo =
    allLooks.find((look) => look.id === selection) || looks[0];
  const currentLive = outfits.find((outfit) => outfit.outfit_id === selection);
  const result =
    job?.status === "SUCCEEDED" &&
    job.result?.model_id === model?.model_id &&
    job.result?.outfit_id === currentLive?.outfit_id
      ? job.result
      : null;
  const visible = looks.filter(
    (look) => category === "all" || look.categories.includes(category),
  );
  const shownImage =
    mode === "demo"
      ? currentDemo.image
      : result?.views.find((view) => view.view === "FRONT")?.url ||
        model?.full_body_image_url ||
        "/images/vell-model.png";

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const wheel = (event: WheelEvent) => {
      const target = event.target as Element;
      if (
        event.ctrlKey ||
        target.closest("button, input, label") ||
        (target.closest("a") && !target.closest(".vell-shopping-regions"))
      )
        return;
      event.preventDefault();
      const delta =
        event.deltaY *
        (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1);
      setZoom((current) => Math.max(80, Math.min(155, current - delta * 0.08)));
    };
    stage.addEventListener("wheel", wheel, { passive: false });
    return () => stage.removeEventListener("wheel", wheel);
  }, []);

  useEffect(() => {
    api<Model[]>("/vell/models")
      .then(({ data }) => {
        setModels(data);
        setModel(
          data.find((entry) => entry.name === "Han Seo-yeon") ||
            data[0] ||
            null,
        );
      })
      .catch(() => {});
    try {
      const stored = JSON.parse(
        localStorage.getItem("vell-demo-library") || "[]",
      );
      if (Array.isArray(stored))
        setSaved(stored.filter((id) => typeof id === "string"));
    } catch {
      /* empty library */
    }
  }, []);
  useEffect(() => {
    if (!job || !["QUEUED", "RUNNING"].includes(job.status)) return;
    const timer = window.setTimeout(() => {
      api<Job>(`/vell/try-ons/${job.id}`)
        .then(({ data }) =>
          setJob((current) => (current?.id === data.id ? data : current)),
        )
        .catch((cause) => setError(message(cause)));
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [job]);
  useEffect(() => {
    setRegions([]);
    setRegionsFor("");
    if (mode !== "live" || !result || !job) return;
    let active = true;
    api<{ regions: Region[] }>(
      `/vell/try-on-results/${job.id}/shopping-regions`,
    )
      .then(({ data }) => {
        if (active) {
          setRegions(data.regions);
          setRegionsFor(job.id);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [result, job, mode]);
  const remember = (next: History) => {
    setHistory((old) => [...old.slice(-29), { selection, category, filter }]);
    setFuture([]);
    setSelection(next.selection);
    setCategory(next.category);
    setFilter(next.filter);
  };
  const selectDemo = (id: string) => {
    setMode("demo");
    remember({ selection: id, category, filter });
    setMobilePanel(false);
  };
  const changeCategory = (id: string) => {
    const first = looks.find(
      (look) => id === "all" || look.categories.includes(id),
    );
    remember({
      selection: mode === "demo" ? first?.id || "street" : selection,
      category: id,
      filter,
    });
  };
  const traverse = (direction: "undo" | "redo") => {
    const source = direction === "undo" ? history : future;
    const previous = source[source.length - 1];
    if (!previous) return;
    const snapshot = { selection, category, filter };
    if (direction === "undo") {
      setHistory(source.slice(0, -1));
      setFuture([...future, snapshot]);
    } else {
      setFuture(source.slice(0, -1));
      setHistory([...history, snapshot]);
    }
    setMode(
      allLooks.some((look) => look.id === previous.selection) ? "demo" : "live",
    );
    setSelection(previous.selection);
    setCategory(previous.category);
    setFilter(previous.filter);
  };
  async function ensureSession(): Promise<Session> {
    if (!user.data)
      throw new Error("Đăng nhập để sử dụng sản phẩm thật và thử đồ AI.");
    if (!model) throw new Error("Chưa có người mẫu VELL khả dụng.");
    if (session && session.model_id === model.model_id) return session;
    const created = (
      await api<Session>("/vell/sessions", {
        method: "POST",
        body: json({ model_id: model.model_id }),
      })
    ).data;
    setSession(created);
    return created;
  }
  async function loadLive(id = category) {
    const version = ++requestVersion.current;

    setError("");
    setBusy(true);
    setOutfits([]);
    setJob(null);
    try {
      const active = await ensureSession();
      const selected =
        categories.find((entry) => entry.id === id) || categories[0];
      const response = await api<{ outfits: Outfit[] }>(
        "/vell/recommendations",
        {
          method: "POST",
          body: json({
            session_id: active.session_id,
            occasion: selected.occasion,
            style: selected.style,
            budget_max_vnd: 10000000,
            preferred_colors: [],
          }),
        },
      );
      if (version !== requestVersion.current) return;
      setOutfits(response.data.outfits);
    } catch (cause) {
      if (version === requestVersion.current) setError(message(cause));
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  }
  useEffect(() => {
    if (!user.data || !model) return;
    void loadLive(category);
    return () => {
      requestVersion.current++;
    };
  }, [user.data?.id, model?.model_id, category]);
  async function generate() {
    if (!currentLive || !consent || busy) return;
    setBusy(true);
    setError("");
    setJob(null);
    try {
      let active = await ensureSession();
      active = (
        await api<Session>(`/vell/sessions/${active.session_id}`, {
          method: "PATCH",
          body: json({
            version: active.version,
            outfit_id: currentLive.outfit_id,
          }),
        })
      ).data;
      setSession(active);
      const submitted = (
        await api<Job>("/vell/try-ons", {
          method: "POST",
          headers: idempotency(),
          body: json({
            session_id: active.session_id,
            session_version: active.version,
            try_on_mode: "MULTI_GARMENT",
            consent_external_processing: true,
          }),
        })
      ).data;
      setJob(submitted);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (mode === "demo") {
      const next = saved.includes(selection) ? saved : [...saved, selection];
      setSaved(next);
      localStorage.setItem("vell-demo-library", JSON.stringify(next));
      toast("Đã lưu ảnh minh họa trên thiết bị này.");
      return;
    }
    if (!result || !job) {
      toast("Hãy tạo ảnh mặc thử trước khi lưu.");
      return;
    }
    try {
      await api("/vell/saved-looks", {
        method: "POST",
        body: json({
          result_id: job.id,
          name: currentLive?.name || "VELL look",
        }),
      });
      toast("Đã lưu kết quả vào thư viện.");
    } catch (cause) {
      toast(message(cause));
    }
  }
  async function openPanel(name: string) {
    setPanel(name);
    setError("");
    if (name === "Library" && user.data)
      try {
        setServerSaved(
          (await api<typeof serverSaved>("/vell/saved-looks")).data,
        );
      } catch (cause) {
        setError(message(cause));
      }
    if (name === "Shopping bag" && user.data)
      try {
        setBag((await api<typeof bag>("/vell/shopping-bag")).data);
      } catch (cause) {
        setError(message(cause));
      }
  }
  async function restoreSaved(id: string) {
    try {
      const { data } = await api<{
        result: Result;
        outfit: Outfit;
        model: Model;
      }>(`/vell/saved-looks/${id}`);
      setModel(data.model);
      setSession(null);
      setOutfits([data.outfit]);
      setSelection(data.outfit.outfit_id);
      setJob({
        id: serverSaved.find((entry) => entry.saved_look_id === id)!.result_id,
        status: "SUCCEEDED",
        result: data.result,
        error: null,
      });
      setMode("live");
      setPanel(null);
    } catch (cause) {
      setError(message(cause));
    }
  }
  function randomize() {
    const entries = mode === "demo" ? visible : outfits;
    if (!entries.length) return;
    const chosen = entries[Math.floor(Math.random() * entries.length)];
    if ("id" in chosen) selectDemo(chosen.id);
    else {
      setSelection(chosen.outfit_id);
      setJob(null);
    }
  }
  function chooseModel(next: Model) {
    requestVersion.current++;
    setModel(next);
    setSession(null);
    setJob(null);
    setOutfits([]);
    setMode("demo");
    setSelection(
      next.name === "Han Seo-yeon"
        ? "street"
        : `${modelSlugs[next.name]}-everyday`,
    );
    setCategory("all");
    setHistory([]);
    setFuture([]);
    setPanel(null);
    setError("");
  }
  const validRegions = (
    mode === "live" && result && regionsFor === job?.id ? regions : []
  ).filter(
    (region) =>
      Date.parse(region.valid_until) > Date.now() &&
      region.polygon.length >= 3 &&
      region.polygon.every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1),
  );
  return (
    <div
      className="vell-shell"
      style={{ "--vell-realism": realism / 100 } as CSSProperties}
    >
      <div className="vell-backdrop" data-filter={filter} />
      <header className="vell-header">
        <div className="vell-brand">
          <Link href="/" aria-label="Về trang chủ" className="vell-logo">
            VELL
          </Link>
          <span>CREATE A VELL</span>
        </div>
        <div className="vell-header-actions">
          <Link href="/catalog" aria-label="Mở cửa hàng">
            <ShoppingCart size={20} />
          </Link>
          <button
            aria-label="Mở thư viện đã lưu"
            onClick={() => void openPanel("Library")}
          >
            <Heart size={20} />
          </button>
          <button
            aria-label="Mở túi đồ"
            onClick={() => void openPanel("Shopping bag")}
          >
            <ShoppingBag size={19} />
          </button>
          <button aria-label="Tùy chọn" onClick={() => void openPanel("Menu")}>
            <MoreHorizontal size={22} />
          </button>
        </div>
      </header>
      <div className="vell-profile glass">
        <img src={shownImage} alt="" />
        <div>
          <strong>
            {mode === "demo"
              ? currentDemo.modelName || "Han Seo-yeon"
              : model?.name || "VELL model"}{" "}
            <button
              className="vell-edit"
              aria-label="Chọn người mẫu"
              onClick={() => void openPanel("Models")}
            >
              <Pencil size={14} />
            </button>
          </strong>
          <small>
            {mode === "demo" && !currentDemo.modelName ? (
              <>
                23 &nbsp;|&nbsp; Seoul, KR &nbsp;|&nbsp; <Cloud size={15} />{" "}
                14°C
              </>
            ) : (
              "Người mẫu minh họa"
            )}
          </small>
        </div>
        <button aria-label="Xáo trộn outfit" onClick={randomize}>
          <Dice5 size={17} />
        </button>
      </div>
      <section ref={stageRef} className="vell-stage" aria-label="Avatar stage">
        <div
          className={`vell-model ${result ? "generated" : ""}`}
          style={{ transform: `translateX(-50%) scale(${zoom / 100})` }}
        >
          <AnimatedAvatar
            src={shownImage}
            alt={
              mode === "demo"
                ? `Ảnh minh họa ${currentDemo.title}`
                : result
                  ? "Ảnh AI đang chờ kiểm duyệt"
                  : "Người mẫu VELL"
            }
            shoppingTargets={
              mode === "demo"
                ? illustrativeShopping[currentDemo.id] || []
                : [...validRegions]
                    .sort((a, b) => a.layer_priority - b.layer_priority)
                    .map((region) => ({
                      id: region.region_id,
                      name: region.product_name,
                      retailer: region.retailer_name,
                      url: region.verified_product_url,
                      match: "VERIFIED" as const,
                      validUntil: region.valid_until,
                      polygons: [region.polygon],
                      marker: region.polygon.reduce<[number, number]>(
                        (sum, [x, y]) => [
                          sum[0] + x / region.polygon.length,
                          sum[1] + y / region.polygon.length,
                        ],
                        [0, 0],
                      ),
                    }))
            }
            onExpired={() => {
              setRegions([]);
              toast("Xác minh sản phẩm đã hết hạn.");
            }}
          />
        </div>
        {mode === "live" && currentLive && !result && (
          <div className="vell-tryon-callout glass">
            <strong>{currentLive.name}</strong>
            <span>
              {currentLive.garments.length} sản phẩm · Chưa tạo ảnh mặc thử
            </span>
            <label>
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />{" "}
              Cho phép gửi ảnh người mẫu và sản phẩm đến dịch vụ AI
            </label>
            <button
              disabled={
                !consent ||
                busy ||
                (!!job && ["QUEUED", "RUNNING"].includes(job.status))
              }
              onClick={() => void generate()}
            >
              {job && ["QUEUED", "RUNNING"].includes(job.status)
                ? "Đang xử lý…"
                : busy
                  ? "Đang gửi…"
                  : "Tạo ảnh mặc thử"}
            </button>
            {job?.status === "FAILED" && (
              <p role="alert">
                {job.error?.message || "Tạo ảnh không thành công."}
              </p>
            )}
            {job && ["QUEUED", "RUNNING"].includes(job.status) && (
              <button
                onClick={() =>
                  void api<Job>(`/vell/try-ons/${job.id}/cancel`, {
                    method: "POST",
                  })
                    .then(({ data }) => setJob(data))
                    .catch((cause) => setError(message(cause)))
                }
              >
                Hủy yêu cầu
              </button>
            )}
          </div>
        )}
      </section>
      <aside
        className={`vell-right glass ${mobilePanel ? "mobile-open" : ""}`}
        aria-label="Outfit recommendations"
      >
        <div className="vell-panel-head">
          <div>
            <span>OUTFITS</span>
            <small>{visible.length + outfits.length} looks</small>
          </div>
          <button
            className="vell-mobile-close"
            onClick={() => setMobilePanel(false)}
            aria-label="Đóng outfits"
          >
            <X size={19} />
          </button>
        </div>
        <div className="vell-categories" aria-label="Tình huống sử dụng">
          {categories.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={category === id ? "active" : ""}
              aria-pressed={category === id}
              onClick={() => changeCategory(id)}
            >
              <span>
                <Icon size={18} />
              </span>
              <small>{label}</small>
            </button>
          ))}
        </div>
        {error && (
          <div className="vell-error" role="alert">
            {error}
            {!user.data && mode === "live" && (
              <Link href="/login?returnTo=%2Fvell">
                Đăng nhập <ArrowUpRight size={13} />
              </Link>
            )}
          </div>
        )}
        <div className="vell-grid" aria-busy={busy}>
          {visible.map((look) => (
            <button
              key={look.id}
              className={`vell-outfit-card ${selection === look.id ? "active" : ""}`}
              onClick={() => selectDemo(look.id)}
              aria-label={`Xem ${look.title}`}
              aria-pressed={selection === look.id}
            >
              <img src={look.image} alt="" />
              <span>{look.title}</span>
            </button>
          ))}
          {outfits.map((outfit) => (
            <button
              key={outfit.outfit_id}
              className={`vell-outfit-card live ${selection === outfit.outfit_id ? "active" : ""}`}
              onClick={() => {
                setMode("live");
                setSelection(outfit.outfit_id);
                setJob(null);
                setMobilePanel(false);
              }}
              aria-label={`Thử ${outfit.name}`}
            >
              <div className="vell-product-collage">
                {outfit.garments.map(
                  ({ product }) =>
                    product.image && (
                      <img key={product.id} src={product.image.url} alt="" />
                    ),
                )}
              </div>
              <span>{outfit.name}</span>
            </button>
          ))}
        </div>
      </aside>
      <div className="vell-mobile-toggle">
        <button onClick={() => setMobilePanel(true)}>
          <Menu size={17} /> Outfits{" "}
          <span>{visible.length + outfits.length}</span>
        </button>
      </div>
      <footer className="vell-toolbar">
        <div className="vell-toolbar-bottom">
          <div className="vell-realism glass">
            <div>
              Realism <span>{realism}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={realism}
              onChange={(event) => setRealism(Number(event.target.value))}
              aria-label="Realism"
              title="Điều chỉnh độ nét, tương phản và màu sắc hiển thị; không tạo lại ảnh AI"
            />
          </div>
          <div className="vell-actions glass">
            <button onClick={() => traverse("undo")} disabled={!history.length}>
              <Undo2 size={18} /> Undo
            </button>
            <button onClick={() => traverse("redo")} disabled={!future.length}>
              <Redo2 size={18} /> Redo
            </button>
            <button
              onClick={() => {
                requestVersion.current++;
                setHistory([]);
                setFuture([]);
                setSelection(
                  model?.name && modelSlugs[model.name]
                    ? `${modelSlugs[model.name]}-everyday`
                    : "street",
                );
                setCategory("all");
                setMode("demo");
                setHistory([]);
                setFuture([]);
                setFilter("Cool Studio");
                setRealism(75);
                setConsent(false);
                setMobilePanel(false);
                setSection("Outfits");
                setPanel(null);
                setError("");
                setJob(null);
                setZoom(100);
              }}
            >
              <RotateCcw size={18} /> Reset
            </button>
          </div>
          <StudioFilter
            value={filter}
            image={shownImage}
            onChange={(next) => remember({ selection, category, filter: next })}
          />
          <button className="vell-save glass" onClick={() => void save()}>
            <Save size={17} />{" "}
            {mode === "demo" && saved.includes(selection)
              ? "SAVED TO LIBRARY"
              : "SAVE TO LIBRARY"}
          </button>
        </div>
      </footer>
      {panel && (
        <div className="vell-dialog-backdrop" onClick={() => setPanel(null)}>
          <section
            className="vell-dialog glass"
            role="dialog"
            aria-modal="true"
            aria-label={panel}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="vell-dialog-close"
              onClick={() => setPanel(null)}
              aria-label="Đóng"
            >
              <X size={20} />
            </button>
            <h2>{panel}</h2>
            {panel === "Library" ? (
              <>
                <p>Ảnh minh họa lưu trên thiết bị này</p>
                <div className="vell-library">
                  {saved.length ? (
                    saved.map((id) => {
                      const look = allLooks.find((entry) => entry.id === id);
                      return (
                        look && (
                          <div key={id}>
                            <button
                              onClick={() => {
                                const owner = models.find(
                                  (entry) =>
                                    entry.name ===
                                    (look.modelName || "Han Seo-yeon"),
                                );
                                if (owner) {
                                  chooseModel(owner);
                                }
                                setMode("demo");
                                setCategory("all");
                                setSelection(id);
                                setPanel(null);
                              }}
                            >
                              <img src={look.image} alt="" />
                              {look.title}
                            </button>
                            <button
                              onClick={() => {
                                const next = saved.filter(
                                  (entry) => entry !== id,
                                );
                                setSaved(next);
                                localStorage.setItem(
                                  "vell-demo-library",
                                  JSON.stringify(next),
                                );
                              }}
                            >
                              Xóa
                            </button>
                          </div>
                        )
                      );
                    })
                  ) : (
                    <p>Chưa lưu ảnh minh họa.</p>
                  )}
                </div>
                {user.data && (
                  <>
                    <h3>Ảnh mặc thử đã lưu</h3>
                    {serverSaved.length ? (
                      serverSaved.map((entry) => (
                        <div
                          key={entry.saved_look_id}
                          className="vell-saved-row"
                        >
                          <button
                            onClick={() =>
                              void restoreSaved(entry.saved_look_id)
                            }
                          >
                            {entry.name}
                          </button>
                          <button
                            onClick={() =>
                              void api(
                                `/vell/saved-looks/${entry.saved_look_id}`,
                                { method: "DELETE" },
                              )
                                .then(() =>
                                  setServerSaved((current) =>
                                    current.filter(
                                      (item) =>
                                        item.saved_look_id !==
                                        entry.saved_look_id,
                                    ),
                                  ),
                                )
                                .catch((cause) => setError(message(cause)))
                            }
                          >
                            Xóa
                          </button>
                        </div>
                      ))
                    ) : (
                      <p>Chưa có ảnh mặc thử đã lưu.</p>
                    )}
                    <Link href="/my-looks">
                      Mở thư viện <ArrowUpRight size={13} />
                    </Link>
                  </>
                )}
              </>
            ) : panel === "Models" || panel === "DNA" || panel === "Face" ? (
              <>
                <p>
                  Chọn người mẫu có sẵn. Các tùy chỉnh khuôn mặt và tóc chưa
                  được hỗ trợ.
                </p>
                <div className="vell-model-picker">
                  {models.length ? (
                    models.map((entry) => (
                      <button
                        key={entry.model_id}
                        onClick={() => chooseModel(entry)}
                      >
                        <img src={entry.portrait_url} alt="" />
                        <span>{entry.name}</span>
                      </button>
                    ))
                  ) : (
                    <p>Chưa tải được người mẫu từ máy chủ.</p>
                  )}
                </div>
              </>
            ) : panel === "Menu" ? (
              <div className="vell-dialog-links">
                <Link href="/">Trang chủ</Link>
                <Link href="/catalog">Collection</Link>
                <Link href="/my-looks">My looks</Link>
                <Link href="/stylist">AI Stylist</Link>
              </div>
            ) : panel === "Shopping bag" ? (
              <>
                {!user.data ? (
                  <p>
                    Đăng nhập để xem túi đồ của bạn.{" "}
                    <Link href="/login?returnTo=%2Fvell">Đăng nhập</Link>
                  </p>
                ) : bag.length ? (
                  bag.map(({ product }) => (
                    <div className="vell-saved-row" key={product.id}>
                      <span>{product.name}</span>
                      <button
                        onClick={() =>
                          void api(`/vell/shopping-bag/items/${product.id}`, {
                            method: "DELETE",
                          })
                            .then(() =>
                              setBag((current) =>
                                current.filter(
                                  (item) => item.product.id !== product.id,
                                ),
                              ),
                            )
                            .catch((cause) => setError(message(cause)))
                        }
                      >
                        Xóa
                      </button>
                    </div>
                  ))
                ) : (
                  <p>Túi đồ của bạn chưa có sản phẩm.</p>
                )}
                <Link href="/catalog">
                  Mở Collection <ArrowUpRight size={14} />
                </Link>
              </>
            ) : (
              <>
                <p>
                  Phần {panel} hiện chưa có công cụ chỉnh sửa được hỗ trợ. Bạn
                  có thể chọn trang phục hoặc đổi người mẫu có sẵn.
                </p>
                <button
                  className="vell-dialog-button"
                  onClick={() => setPanel("Models")}
                >
                  Chọn người mẫu
                </button>
                <button
                  className="vell-dialog-button"
                  onClick={() => {
                    setPanel(null);
                    setSection("Outfits");
                    setMobilePanel(true);
                  }}
                >
                  Xem trang phục
                </button>
              </>
            )}
            {error && <p role="alert">{error}</p>}
          </section>
        </div>
      )}
    </div>
  );
}

function AnimatedAvatar({
  src,
  alt,
  shoppingTargets,
  onExpired,
}: {
  src: string;
  alt: string;
  shoppingTargets: ShoppingTarget[];
  onExpired: () => void;
}) {
  const [loaded, setLoaded] = useState({ src: "", width: 1, height: 1 });
  const [frame, setFrame] = useState({ src, previous: "" });
  useEffect(() => {
    let cancelled = false;
    const incoming = new window.Image();
    incoming.src = src;
    incoming
      .decode()
      .then(() => {
        if (!cancelled) {
          // Also handles an SSR image that loaded before React attached onLoad.
          setLoaded({
            src,
            width: incoming.naturalWidth,
            height: incoming.naturalHeight,
          });
          setFrame((current) =>
            current.src === src ? current : { src, previous: current.src },
          );
        }
      })
      .catch(() => {
        /* Keep the last valid image if loading fails. */
      });
    return () => {
      cancelled = true;
    };
  }, [src]);
  useEffect(() => {
    if (!frame.previous) return;
    const timer = window.setTimeout(
      () => setFrame((current) => ({ ...current, previous: "" })),
      1100,
    );
    return () => window.clearTimeout(timer);
  }, [frame.src, frame.previous]);
  return (
    <>
      {frame.previous && (
        <img
          src={frame.previous}
          alt=""
          aria-hidden="true"
          className="vell-avatar-previous"
        />
      )}
      <img
        key={frame.src}
        src={frame.src}
        alt={alt}
        className={`vell-avatar-current ${frame.previous ? "vell-avatar-enter" : ""}`}
      />
      {frame.src === src && loaded.src === src && !frame.previous && (
        <VellShoppingOverlay
          key={`shopping-${src}`}
          targets={shoppingTargets}
          width={loaded.width}
          height={loaded.height}
          onExpired={onExpired}
        />
      )}
      {frame.previous && (
        <span
          key={`glow-${frame.src}`}
          className="vell-outfit-glow"
          aria-hidden="true"
        />
      )}
    </>
  );
}

const studioFilters = [
  { name: "Cool Studio", description: "Sắc lạnh · Trong trẻo", tone: "cool" },
  {
    name: "Neutral Studio",
    description: "Cân bằng · Tự nhiên",
    tone: "neutral",
  },
  { name: "Warm Studio", description: "Sắc ấm · Dịu dàng", tone: "warm" },
];
function StudioFilter({
  value,
  image,
  onChange,
}: {
  value: string;
  image: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    root.current
      ?.querySelector<HTMLElement>('[role="option"][aria-selected="true"]')
      ?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  function choose(name: string) {
    onChange(name);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      className="vell-filter glass"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
        if (!open) {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
          return;
        }
        const options = Array.from(
          root.current?.querySelectorAll<HTMLButtonElement>(
            '[role="option"]',
          ) || [],
        );
        const index = options.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        let next = index;
        if (event.key === "ArrowDown") next = (index + 1) % options.length;
        else if (event.key === "ArrowUp")
          next = (index - 1 + options.length) % options.length;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = options.length - 1;
        else return;
        event.preventDefault();
        options[next]?.focus();
      }}
    >
      <div className="vell-filter-heading">
        <span>STUDIO LIGHTING</span>
        <button
          ref={trigger}
          className="vell-filter-trigger"
          aria-label="Filter"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen(!open)}
        >
          <span
            className="vell-filter-tone"
            data-tone={
              studioFilters.find((entry) => entry.name === value)?.tone
            }
          />
          <span>{value}</span>
          <ChevronDown size={14} />
        </button>
      </div>
      <div className="vell-filter-swatches" aria-label="Chọn nhanh ánh sáng">
        {studioFilters.map(({ name }) => (
          <button
            key={name}
            data-filter={name}
            aria-label={name}
            aria-pressed={value === name}
            onClick={() => choose(name)}
          >
            <img src={image} alt="" />
          </button>
        ))}
      </div>
      {open && (
        <div
          className="vell-light-menu"
          id={menuId}
          role="listbox"
          aria-label="Ánh sáng studio"
        >
          {studioFilters.map(({ name, description, tone }) => (
            <button
              key={name}
              role="option"
              aria-selected={value === name}
              onClick={() => choose(name)}
            >
              <span className="vell-light-preview" data-tone={tone} />
              <span className="vell-light-copy">
                <strong>{name}</strong>
                <small>{description}</small>
              </span>
              {value === name && <Check size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
