"use client";
import { useI18n } from "@/components/locale-provider";
import { createContext, useCallback, useContext, useEffect, useState, } from "react";
import { QueryClient, QueryClientProvider, useQuery, } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
const ToastContext = createContext<(message: string) => void>(() => { });
export const useToast = () => useContext(ToastContext);
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
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(""), 4500);
            return () => clearTimeout(timer);
        }
    }, [message]);
    return (<QueryClientProvider client={client}>
      <ToastContext.Provider value={toast}>
        {children}
        <div className={`toast ${message ? "visible" : ""}`} role="status" aria-live="polite">
          {message}
        </div>
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
