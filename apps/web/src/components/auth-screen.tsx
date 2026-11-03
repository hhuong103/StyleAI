"use client";

import { useI18n } from "@/components/locale-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Sparkles } from "lucide-react";
import Script from "next/script";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, json } from "@/lib/api";
import { ErrorBox } from "./ui";

type GoogleCredentialResponse = { credential?: string };
type GoogleIdentityError = { type: string };
type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        error_callback: (error: GoogleIdentityError) => void;
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: {
          theme: "outline";
          size: "large";
          text: "signin_with" | "signup_with";
          shape: "rectangular";
          width: number;
          locale: string;
        },
      ) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

export function AuthScreen({ register = false }: { register?: boolean }) {
  const { tr, localeTag } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const client = useQueryClient();
  const googleButton = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<unknown>();
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [googleConfigState, setGoogleConfigState] = useState<
    "loading" | "ready" | "unconfigured" | "error"
  >("loading");
  const [googleConfigAttempt, setGoogleConfigAttempt] = useState(0);
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [googleScriptFailed, setGoogleScriptFailed] = useState(false);
  const [googleScriptAttempt, setGoogleScriptAttempt] = useState(0);
  const [googlePending, setGooglePending] = useState(false);

  const schema = z
    .object({
      email: z.email(tr("Email chưa hợp lệ.")),
      password: z
        .string()
        .min(
          register ? 12 : 1,
          register
            ? tr("Mật khẩu cần ít nhất 12 ký tự.")
            : tr("Nhập mật khẩu."),
        )
        .max(128),
      display_name: z.string().max(80),
    })
    .refine((value) => !register || value.display_name.trim().length > 0, {
      message: tr("Nhập tên của bạn."),
      path: ["display_name"],
    });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "", display_name: "" },
  });

  const finishSignIn = useCallback(async () => {
    await client.invalidateQueries({ queryKey: ["session"] });
    const returnTo = params.get("returnTo");
    router.push(
      returnTo?.startsWith("/") &&
        !returnTo.startsWith("//") &&
        !returnTo.includes("\\")
        ? returnTo
        : register
          ? "/profile"
          : "/stylist",
    );
  }, [client, params, register, router]);

  const handleGoogleCredential = useCallback(
    (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        setError(
          new Error(
            tr(
              "Google không trả về thông tin xác thực. Hãy kiểm tra OAuth Client ID loại Web và Authorized JavaScript origins có chứa chính xác http://localhost:3002.",
            ),
          ),
        );
        return;
      }
      setError(undefined);
      setGooglePending(true);
      void api("/auth/google", {
        method: "POST",
        body: json({ credential: response.credential }),
      })
        .then(finishSignIn)
        .catch(setError)
        .finally(() => setGooglePending(false));
    },
    [finishSignIn, tr],
  );

  useEffect(() => {
    let active = true;
    api<{ client_id: string | null }>("/auth/google/config")
      .then(({ data }) => {
        if (active) {
          const clientId = data.client_id?.trim() || null;
          setGoogleClientId(clientId);
          setGoogleConfigState(clientId ? "ready" : "unconfigured");
        }
      })
      .catch(() => {
        if (active) setGoogleConfigState("error");
      });
    return () => {
      active = false;
    };
  }, [googleConfigAttempt]);

  useEffect(() => {
    if (!googleClientId || !googleScriptReady) return;
    if (!window.google || !googleButton.current) {
      setGoogleScriptFailed(true);
      return;
    }
    const element = googleButton.current;
    element.replaceChildren();
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: handleGoogleCredential,
      error_callback: ({ type }) => {
        setError(
          new Error(
            type === "popup_failed_to_open"
              ? tr(
                  "Trình duyệt đã chặn cửa sổ đăng nhập Google. Hãy cho phép popup rồi thử lại.",
                )
              : type === "popup_closed"
                ? tr("Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.")
                : tr(
                    "Google từ chối yêu cầu OAuth. Hãy kiểm tra Client ID loại Web, trạng thái ứng dụng và Authorized JavaScript origins trong Google Cloud Console.",
                  ),
          ),
        );
      },
    });
    window.google.accounts.id.renderButton(element, {
      theme: "outline",
      size: "large",
      text: register ? "signup_with" : "signin_with",
      shape: "rectangular",
      width: Math.min(380, Math.max(120, element.clientWidth || 380)),
      locale: localeTag === "vi-VN" ? "vi" : "en",
    });
    return () => element.replaceChildren();
  }, [
    googleClientId,
    googleScriptReady,
    handleGoogleCredential,
    localeTag,
    register,
  ]);

  useEffect(() => {
    if (
      googleConfigState !== "ready" ||
      !googleClientId ||
      googleScriptReady ||
      googleScriptFailed
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setGoogleScriptFailed(true);
    }, 12000);
    return () => window.clearTimeout(timeout);
  }, [
    googleClientId,
    googleConfigState,
    googleScriptFailed,
    googleScriptReady,
    googleScriptAttempt,
  ]);

  async function submit(values: z.infer<typeof schema>) {
    setError(undefined);
    try {
      if (register)
        await api("/auth/register", {
          method: "POST",
          body: json(values),
        });
      await api("/auth/login", {
        method: "POST",
        body: json({ email: values.email, password: values.password }),
      });
      await finishSignIn();
    } catch (cause) {
      setError(cause);
    }
  }

  return (
    <section className="auth-layout container">
      <div className="auth-editorial auth-photographic">
        <p className="eyebrow">{tr("A LITTLE MORE YOU.")}</p>
        <h1>
          {tr("Your style.")}
          <br />
          <em>{tr("Your space.")}</em>
        </h1>
        <img
          src="/images/editorial/clean-edit.webp"
          alt={tr("Bộ vest màu kem thanh lịch trong khung cảnh thành phố")}
          width={900}
          height={1350}
        />
        <p>{tr("Một tủ đồ ý tưởng, được phối dành cho bạn.")}</p>
      </div>
      <div className="auth-form">
        <Sparkles size={24} />
        <p className="eyebrow">{tr("WELCOME TO STYLEAI")}</p>
        <h2>
          {register ? tr("Bắt đầu với chính bạn.") : tr("Chào mừng trở lại.")}
        </h2>
        <p>
          {register
            ? tr("Tạo tài khoản để khám phá và lưu những Look của riêng bạn.")
            : tr("Những ý tưởng phối đồ mới đang chờ bạn.")}
        </p>
        <ErrorBox error={error} />
        <form onSubmit={form.handleSubmit(submit)} noValidate>
          {register && (
            <label>
              {tr("Tên của bạn")}
              <input autoComplete="name" {...form.register("display_name")} />
              <span className="field-error">
                {form.formState.errors.display_name?.message}
              </span>
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              {...form.register("email")}
            />
            <span className="field-error">
              {form.formState.errors.email?.message}
            </span>
          </label>
          <label>
            {tr("Mật khẩu")}
            <input
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              {...form.register("password")}
            />
            <span className="field-error">
              {form.formState.errors.password?.message}
            </span>
          </label>
          <button
            className="button full"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting
              ? tr("Đang xử lý…")
              : register
                ? tr("Tạo tài khoản")
                : tr("Đăng nhập")}
            <ArrowRight size={16} />
          </button>
        </form>

        {googleConfigState === "ready" && googleClientId && (
          <Script
            key={googleScriptAttempt}
            src="https://accounts.google.com/gsi/client"
            strategy="afterInteractive"
            onLoad={() => {
              setGoogleScriptFailed(false);
              setGoogleScriptReady(true);
            }}
            onError={() => {
              setGoogleScriptReady(false);
              setGoogleScriptFailed(true);
            }}
          />
        )}
        <div className="google-login">
          {googleConfigState === "loading" && (
            <p className="google-login-note" role="status">
              {tr("Đang kiểm tra cấu hình đăng nhập Google…")}
            </p>
          )}
          {googleConfigState === "unconfigured" && (
            <div className="google-login-note google-config-help">
              <p>{tr("Đăng nhập Google chưa được cấu hình.")}</p>
              <a
                href="https://console.cloud.google.com/auth/clients"
                target="_blank"
                rel="noreferrer"
              >
                {tr("Mở Google Cloud Console")}
              </a>
            </div>
          )}
          {googleConfigState === "error" && (
            <div className="google-login-note google-config-help" role="alert">
              <p>{tr("Không thể kiểm tra cấu hình đăng nhập Google.")}</p>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setGoogleConfigState("loading");
                  setGoogleConfigAttempt((attempt) => attempt + 1);
                }}
              >
                {tr("Thử lại")}
              </button>
            </div>
          )}
          {googleConfigState === "ready" &&
            googleScriptFailed &&
            googleClientId && (
              <div
                className="google-login-note google-config-help"
                role="alert"
              >
                <p>{tr("Không thể tải dịch vụ Google.")}</p>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setGoogleScriptFailed(false);
                    setGoogleScriptReady(false);
                    setGoogleScriptAttempt((attempt) => attempt + 1);
                  }}
                >
                  {tr("Thử lại")}
                </button>
              </div>
            )}
          {googleConfigState === "ready" &&
            !googleScriptFailed &&
            !googleScriptReady && (
              <p className="google-login-note" role="status">
                {tr("Đang tải dịch vụ Google…")}
              </p>
            )}
          {googleConfigState === "ready" &&
            googleScriptReady &&
            !googleScriptFailed && <div ref={googleButton} />}
          {googlePending && (
            <p className="google-login-note" role="status">
              {tr("Đang đăng nhập với Google…")}
            </p>
          )}
        </div>

        <p className="auth-switch">
          {register ? tr("Đã có tài khoản?") : tr("Chưa có tài khoản?")}{" "}
          <Link href={register ? "/login" : "/register"}>
            {register ? tr("Đăng nhập") : tr("Tạo tài khoản")}
          </Link>
        </p>
      </div>
    </section>
  );
}
