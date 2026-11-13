"use client";
import { useI18n } from "@/components/locale-provider";
import { createContext, useCallback, useContext, useEffect, useState, } from "react";
import { QueryClient, QueryClientProvider, useQuery, } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
const ToastContext = createContext<(message: string) => void>(() => { });
export const useToast = () => useContext(ToastContext);
const WaitlistContext = createContext<{
    items: WaitlistEntry[];
    ready: boolean;
    add: (item: WaitlistEntry) => void;
    remove: (productId: string) => void;
}>({
    items: [],
    ready: false,
    add: () => { },
    remove: () => { },
});
const WAITLIST_STORAGE_KEY = "styleai_waitlist_v1";
export type WaitlistEntry = { product_id: string; variant_id: string };
export const useWaitlist = () => useContext(WaitlistContext);
export function Providers({ children }: {
    children: React.ReactNode;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    const [client] = useState(() => new QueryClient({
        defaultOptions: {
            queries: { retry: false, staleTime: 30000 },
            mutations: { retry: false },
        },
    }));
    const [message, setMessage] = useState("");
    const toast = useCallback((value: string) => setMessage(value), []);
    const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
    const [waitlistReady, setWaitlistReady] = useState(false);
    const addWaitlistItem = useCallback((item: WaitlistEntry) => {
        setWaitlist((items) => [
            ...items.filter((current) => current.product_id !== item.product_id),
            item,
        ]);
    }, []);
    const removeWaitlistItem = useCallback((productId: string) => {
        setWaitlist((items) => items.filter((item) => item.product_id !== productId));
    }, []);
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(""), 4500);
            return () => clearTimeout(timer);
        }
    }, [message]);
    useEffect(() => {
        try {
            const stored = localStorage.getItem(WAITLIST_STORAGE_KEY);
            if (stored) {
                const parsed: unknown = JSON.parse(stored);
                if (!Array.isArray(parsed)) throw new Error("Waitlist data must be an array.");
                setWaitlist(parsed.filter((item): item is WaitlistEntry =>
                    typeof item?.product_id === "string" && typeof item?.variant_id === "string"
                ));
            }
        } catch (error) {
            toast(error instanceof Error ? error.message : tr("Không thể đọc danh sách chờ."));
        } finally {
            setWaitlistReady(true);
        }
    }, [toast, tr]);
    useEffect(() => {
        if (!waitlistReady) return;
        try {
            localStorage.setItem(WAITLIST_STORAGE_KEY, JSON.stringify(waitlist));
        } catch (error) {
            toast(error instanceof Error ? error.message : tr("Không thể lưu danh sách chờ."));
        }
    }, [waitlist, waitlistReady, toast, tr]);
    return (<QueryClientProvider client={client}>
      <ToastContext.Provider value={toast}>
        <WaitlistContext.Provider value={{
            items: waitlist,
            ready: waitlistReady,
            add: addWaitlistItem,
            remove: removeWaitlistItem,
        }}>
        {children}
        <div className={`toast ${message ? "visible" : ""}`} role="status" aria-live="polite">
          {message}
        </div>
        </WaitlistContext.Provider>
      </ToastContext.Provider>
    </QueryClientProvider>);
}
export function useUser() {
    return useQuery({
        queryKey: ["session"],
        queryFn: () => api<User>("/auth/me").then((r) => r.data),
        staleTime: 60000,
    });
}
export function Guard({ children, admin = false, }: {
    children: React.ReactNode;
    admin?: boolean;
}) {
    const { tr, label, money, productName, localeTag } = useI18n();
    const user = useUser();
    const router = useRouter();
    const path = usePathname();
    useEffect(() => {
        if (!user.isPending && !user.data)
            router.replace(`/login?returnTo=${encodeURIComponent(path)}`);
    }, [user.isPending, user.data, router, path]);
    if (user.isPending || !user.data)
        return (<div className="page container">
        <div className="skeleton tall"/>
        <p>{tr("\u0110ang ki\u1EC3m tra phi\u00EAn \u0111\u0103ng nh\u1EADp\u2026")}</p>
      </div>);
    if (admin && user.data.role !== "ADMIN")
        return (<div className="page container">
        <h1>{tr("Kh\u00F4ng c\u00F3 quy\u1EC1n truy c\u1EADp")}</h1>
        <p>{tr("Trang n\u00E0y d\u00E0nh cho qu\u1EA3n tr\u1ECB vi\u00EAn.")}</p>
      </div>);
    return children;
}
