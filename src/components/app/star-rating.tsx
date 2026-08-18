import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

export function StarRating({
  value,
  onChange,
  disabled,
  size = 20,
}: {
  value: number;
  onChange?: (score: number) => void;
  disabled?: boolean;
  size?: number;
}) {
  const interactive = Boolean(onChange) && !disabled;

  return (
    <div className="flex items-center gap-1" role={interactive ? "radiogroup" : undefined}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={!interactive}
          aria-label={`${star} estrela${star > 1 ? "s" : ""}`}
          onClick={() => onChange?.(star)}
          className={cn(
            "transition-transform",
            interactive ? "hover:scale-115 cursor-pointer" : "cursor-default",
            disabled && "opacity-40",
          )}
        >
          <Star
            style={{ width: size, height: size }}
            className={cn(
              star <= Math.round(value) ? "fill-gold text-gold" : "text-muted-foreground",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function ScoreBadge({ score, count }: { score: number; count?: number }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1">
      <Star className="size-3.5 fill-gold text-gold" />
      <span className="text-display text-sm font-bold text-gold">{score.toFixed(1)}</span>
      {typeof count === "number" ? (
        <span className="text-xs text-muted-foreground">({count})</span>
      ) : null}
    </div>
  );
}