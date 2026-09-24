import { useEffect, useState } from "react";
import { Share, PlusSquare, X } from "lucide-react";
import logoAsset from "@/assets/logo.jpg.asset.json";

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ finge ser Mac
  const isIpadOs =
    navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1;
  return isIos || isIpadOs;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

export function IosInstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isIosDevice() && !isStandalone()) {
      const timer = window.setTimeout(() => setVisible(true), 900);
      return () => window.clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Instale o The Match no seu iPhone"
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] backdrop-blur-sm animate-in fade-in duration-200 sm:items-center"
      onClick={() => setVisible(false)}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom-6 duration-300"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex flex-col items-center px-6 pt-7 pb-6 text-center">
          <button
            type="button"
            onClick={() => setVisible(false)}
            aria-label="Fechar instruções de instalação"
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/70"
          >
            <X className="size-4.5" />
          </button>

          <img
            src={logoAsset.url}
            alt="Logo do The Match"
            className="size-20 rounded-3xl border border-border object-cover shadow-lg"
          />

          <h2 className="text-display mt-4 text-2xl font-extrabold leading-tight">
            Adicione o The Match à sua Tela de Início
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Instale o app no seu iPhone para ter a experiência completa.
          </p>

          <div className="mt-6 w-full space-y-4 text-left">
            <div className="flex items-start gap-3.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                1
              </span>
              <div>
                <p className="text-sm font-semibold leading-snug">
                  Toque no ícone de Compartilhar
                </p>
                <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
                  <Share className="size-5 text-primary" />
                  <span className="text-xs font-medium text-primary">
                    Na barra inferior do Safari
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                2
              </span>
              <div>
                <p className="text-sm font-semibold leading-snug">
                  Toque em "Adicionar à Tela de Início"
                </p>
                <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2">
                  <span className="text-xs font-medium text-primary">
                    Adicionar à Tela de Início
                  </span>
                  <PlusSquare className="size-5 text-primary" />
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setVisible(false)}
            className="mt-6 w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
