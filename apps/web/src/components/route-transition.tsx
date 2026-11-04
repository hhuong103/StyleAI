"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";

const NavigationTransition = createContext<(href: string) => void>(() => {});

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [phase, setPhase] = useState("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    pending.current = false;
    if (fallback.current) clearTimeout(fallback.current);
    setPhase("entering");
    const entry = setTimeout(() => setPhase("idle"), 600);
    return () => clearTimeout(entry);
  }, [pathname]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (fallback.current) clearTimeout(fallback.current);
    },
    [],
  );

  const navigate = useCallback(
    (href: string) => {
      if (pending.current) return;
      if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        href === pathname
      ) {
        router.push(href);
        return;
      }
      pending.current = true;
      setPhase("exiting");
      timer.current = setTimeout(() => router.push(href), 220);
      fallback.current = setTimeout(() => {
        pending.current = false;
        setPhase("idle");
      }, 6000);
    },
    [pathname, router],
  );

  return (
    <NavigationTransition.Provider value={navigate}>
      <div className={`fashion-route fashion-route-${phase}`}>
        <div key={pathname} className="route-stage">
          {children}
        </div>
      </div>
      <div
        className={`runway-transition runway-transition-${phase}`}
        aria-hidden="true"
      >
        <span>STYLE IN MOTION</span>
      </div>
    </NavigationTransition.Provider>
  );
}

export function TransitionLink(props: ComponentProps<typeof Link>) {
  const navigate = useContext(NavigationTransition);
  return (
    <Link
      {...props}
      onNavigate={(event) => {
        props.onNavigate?.(event);
        if (typeof props.href === "string") {
          event.preventDefault();
          navigate(props.href);
        }
      }}
    />
  );
}
