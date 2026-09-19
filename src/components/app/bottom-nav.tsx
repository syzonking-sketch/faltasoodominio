import { Link } from "@tanstack/react-router";
import { MapPin, Trophy, UserRound, UsersRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { useNavHidden } from "@/lib/nav-visibility";

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
  const hidden = useNavHidden();

  return (
    <nav
      aria-label="Navegação principal"
      aria-hidden={hidden}
      className={cn(
        "fixed inset-x-0 bottom-0 z-500 px-2 pb-[calc(max(env(safe-area-inset-bottom,0px),0px)+0.625rem)] transition-[transform,opacity] duration-300 ease-out sm:px-4 sm:pb-[calc(max(env(safe-area-inset-bottom,0px),0px)+0.75rem)]",
        hidden
          ? "pointer-events-none translate-y-[calc(100%+1.5rem)] opacity-0"
          : "translate-y-0 opacity-100",
      )}
    >
      <ul className="mx-auto grid h-[4.5rem] w-full max-w-[23rem] grid-cols-5 items-center gap-1 rounded-full border border-nav-foreground/10 bg-nav/95 px-1.5 py-2 shadow-float backdrop-blur-xl sm:h-[4.75rem] sm:gap-1.5 sm:px-2">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex min-w-0 justify-center">
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              tabIndex={hidden ? -1 : undefined}
              className="press group flex size-11 min-w-0 items-center justify-center overflow-hidden rounded-full bg-nav-foreground/10 text-nav-foreground outline-none transition-[width,background-color,color,box-shadow] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-primary sm:size-12"
              activeProps={{
                className: "h-11 w-full bg-primary text-primary-foreground shadow-raised sm:h-12",
              }}
            >
              {({ isActive }) => (
                <>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full sm:size-10">
                    <Icon
                      className="size-[1.35rem] transition-transform duration-300 group-hover:scale-105 sm:size-6"
                      strokeWidth={isActive ? 2.1 : 1.7}
                    />
                  </span>
                  <span
                    className={`text-display overflow-hidden text-[0.625rem] leading-none font-bold whitespace-nowrap transition-[width,opacity,margin] duration-300 sm:text-xs ${isActive ? "mr-2 w-auto opacity-100 sm:mr-3" : "m-0 w-0 opacity-0"}`}
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
