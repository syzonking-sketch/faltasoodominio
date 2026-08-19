import type { ReactNode } from "react";
import logoAsset from "@/assets/logo.jpg.asset.json";
import { BottomNav } from "./bottom-nav";

export function AppShell({
  title,
  subtitle,
  action,
  children,
  bare,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  bare?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-background pb-24">
      {!bare ? (
        <header className="pt-safe sticky top-0 z-400 border-b border-border bg-background/90 px-4 pb-3 backdrop-blur-lg">
          <div className="mx-auto flex max-w-2xl items-end justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src={logoAsset.url} alt="Logo" className="size-10 rounded-lg object-cover border border-primary/20" />
              <div>
                <h1 className="text-display text-2xl leading-none font-bold text-foreground">{title}</h1>
                {subtitle ? (
                  <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
                ) : null}
              </div>
            </div>
            {action}
          </div>
        </header>
      ) : null}
      <main className={bare ? "" : "mx-auto max-w-2xl px-4 py-4"}>{children}</main>
      <BottomNav />
    </div>
  );
}