import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="elevate-soft rise-in rounded-2xl border border-border bg-card p-4"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-11 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-7 w-14 rounded-full" />
          </div>
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rise-in rounded-2xl border border-destructive/30 bg-destructive/8 p-5 text-center">
      <AlertTriangle className="mx-auto size-6 text-destructive" />
      <p className="mt-3 text-sm text-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="press mt-4" onClick={onRetry}>
          <RefreshCw className="size-4" /> Tentar de novo
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rise-in flex flex-col items-center rounded-3xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
        {icon}
      </div>
      <h3 className="text-display mt-4 text-lg text-foreground">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
