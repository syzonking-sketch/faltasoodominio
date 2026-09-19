import { Link } from "@tanstack/react-router";
import { MapPin, Trophy, UserRound, UsersRound } from "lucide-react";

function BallIcon({ className, strokeWidth = 1.7 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 7.1 8.6 9.6l1.3 4h4.2l1.3-4Z" />
      <path d="M12 2.8v4.3M4.2 9.4l4.4.2M19.8 9.4l-4.4.2M7 20.3l2.9-6.7M17 20.3l-2.9-6.7" />
    </svg>
  );
}

const tabs = [
  { to: "/", label: "Radar", icon: MapPin },
  { to: "/matches", label: "Partidas", icon: BallIcon },
  { to: "/teams", label: "Times", icon: UsersRound },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/profile", label: "Perfil", icon: UserRound },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-500 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
    >
      <ul className="mx-auto grid h-[4.75rem] w-full max-w-[23rem] grid-cols-5 items-center gap-1 rounded-full border border-border/40 bg-foreground/95 px-2 py-2 shadow-float backdrop-blur-xl">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to} className="min-w-0">
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="press group flex h-15 min-w-0 flex-col items-center justify-center gap-1 rounded-full px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {({ isActive }) => (
                <>
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-full transition-all duration-300 ease-out sm:size-10 ${isActive ? "-translate-y-0.5 scale-105 bg-primary text-primary-foreground shadow-raised" : "text-background/75 group-hover:text-background"}`}>
                    <Icon
                      className="size-[1.35rem] transition-transform duration-300 group-hover:scale-105 sm:size-6"
                      strokeWidth={isActive ? 2.1 : 1.7}
                    />
                  </span>
                  <span
                    className={`text-display w-full truncate text-center text-[8px] leading-none font-bold tracking-normal transition-colors duration-300 min-[360px]:text-[9px] ${isActive ? "text-primary" : "text-background/60"}`}
                  >
                    {label.toUpperCase()}
                  </span>
                </>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
