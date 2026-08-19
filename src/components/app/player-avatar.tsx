import { cn } from "@/lib/utils";

const sizes = {
  sm: "size-9 text-xs",
  md: "size-12 text-sm",
  lg: "size-20 text-lg",
  xl: "size-28 text-2xl",
} as const;

export const GENERIC_AVATARS = [
  { id: "br", label: "Brasil", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" },
  { id: "team1", label: "Time A", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka" },
  { id: "team2", label: "Time B", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aiden" },
  { id: "state", label: "Estado", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Caleb" },
  { id: "player1", label: "Jogador 1", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan" },
  { id: "player2", label: "Jogador 2", url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Taylor" },
];

export function PlayerAvatar({
  name,
  nickname,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  nickname?: string | null | undefined;
  photoUrl?: string | null | undefined;
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
          className="size-full object-cover bg-surface-1"
        />
      ) : (
        <span className="text-display flex size-full items-center justify-center font-bold text-primary">
          {initials || "?"}
        </span>
      )}
    </div>
  );
}