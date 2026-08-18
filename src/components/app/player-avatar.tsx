import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-9 text-xs",
  md: "size-12 text-sm",
  lg: "size-20 text-lg",
  xl: "size-28 text-2xl",
} as const;

export function PlayerAvatar({
  name,
  nickname,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  nickname?: string | null;
  photoUrl?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const initials = (nickname ?? name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-full border-2 border-primary/40 bg-surface-2",
        sizes[size],
        className,
      )}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={`Foto de ${nickname ?? name}`}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <span className="text-display flex size-full items-center justify-center font-bold text-primary">
          {initials || "?"}
        </span>
      )}
    </div>
  );
}