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
        <header className="pt-safe sticky top-0 z-400 border-b border-border/70 bg-background/85 px-4 pb-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={logoAsset.url}
                alt="Logo"
                className="size-9 rounded-xl border border-border object-cover"
              />
              <div className="min-w-0">
                <h1 className="text-display truncate text-xl leading-none font-bold text-foreground">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>
                ) : null}
              </div>
            </div>
            {action}
          </div>
        </header>
      ) : null}
      <main className={bare ? "" : "mx-auto max-w-2xl px-4 py-5"}>{children}</main>
      <BottomNav />
    </div>
  );
}
