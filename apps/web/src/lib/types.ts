import type { components } from "./schema";
export type ImageRef = components["schemas"]["ImageOutput"];
export type User = components["schemas"]["UserOutput"];
export type Variant = components["schemas"]["VariantOutput"];
export type Product = components["schemas"]["ProductOutput"];
export type Taxon = {
  code: string;
  label: string;
  hex?: string;
  family?: string;
  item_role?: string;
  parent_code?: string | null;
  active: boolean;
};
export type Taxonomy = {
  categories: Taxon[];
  styles: Taxon[];
  occasions: Taxon[];
  colors: Taxon[];
};
export type Profile = {
  display_name: string;
  gender: string | null;
  age_range: string | null;
  locale: string;
  preferred_styles: string[];
  favorite_colors: string[];
  budget_min_vnd: number | null;
  budget_max_vnd: number | null;
};
export type Context = {
  gender: string | null;
  occasion: string;
  style: string;
  preferred_colors: string[];
  budget_max_vnd: number;
  sizes?: Record<string, string>;
};
export type Reason = { code: string; facts: Record<string, unknown> };
export type LookItem = components["schemas"]["LookItemOutput"];
export type Look = {
  look_id: string;
  recommendation_id?: string;
  label: string;
  name: string;
  score: number;
  revision: number;
  total_price_vnd: number;
  budget_max_vnd: number;
  visual: {
    kind: string;
    hotspots: { slot_key: string; x: number; y: number }[];
  };
  reasons: Reason[];
  items: LookItem[];
};
export type SavedLook = Look & {
  id: string;
  is_favorite: boolean;
  version: number;
  created_at: string;
  occasion: string;
  style: string;
  context: Context;
  current_status?: {
    slot_key: string;
    available: boolean;
    current_price_vnd: number;
    price_changed: boolean;
  }[];
};
export type Recommendation = {
  recommendation_id: string;
  status: string;
  context: Context;
  budget_max_vnd: number;
  looks: Look[];
  slot_results: { slot_key: string; role: string; items: LookItem[] }[];
  diagnostics: {
    missing_slots: string[];
    fewer_looks_reason?: string;
    minimum_feasible_budget_vnd?: number;
    constraints: { code: string }[];
  };
};
export type Plan = {
  plan_id: string;
  normalized_context: Context;
  field_sources: Record<string, string>;
  needs_confirmation: string[];
  slots: { slot_key: string; role: string; categories: string[] }[];
  warnings: { code: string; field: string }[];
};
export type Alternative = LookItem & {
  new_total_price_vnd: number;
  delta_price_vnd: number;
  new_look_score: number;
};
export type Reaction = {
  id: string;
  target_type: string;
  target_id: string;
  value: "LIKE" | "DISLIKE";
};
export type Rule = {
  id: string;
  rule_key: string;
  version: number;
  occasion_code: string;
  style_code: string | null;
  gender: string | null;
  slots: {
    slot_key: string;
    role: string;
    categories: string[];
    required: true;
  }[];
  active: boolean;
  priority: number;
};
