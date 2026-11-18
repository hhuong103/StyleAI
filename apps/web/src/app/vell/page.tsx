import type { Metadata } from "next";
import { VellStudio } from "@/components/vell-studio";
import "./vell.css";

export const metadata: Metadata = {
  title: "VELL — AI Fashion Studio",
  description:
    "Khám phá outfit theo hoàn cảnh và thử đồ AI với sản phẩm từ catalog đã xác minh.",
};

export default function VellPage() {
  return <VellStudio />;
}
