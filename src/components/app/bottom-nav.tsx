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
        "fixed inset-x-0 bottom-0 z-500 px-2.5 pb-[calc(max(env(safe-area-inset-bottom,0px),0px)+0.625rem)] transition-[transform,opacity] duration-300 ease-out min-[400px]:px-3 sm:px-4 sm:pb-[calc(max(env(safe-area-inset-bottom,0px),0px)+0.75rem)]",
        hidden
          ? "pointer-events-none translate-y-[calc(100%+1.5rem)] opacity-0"
          : "translate-y-0 opacity-100",
      )}
    >
      <ul className="mx-auto grid h-[4.875rem] w-full max-w-[32rem] grid-cols-5 items-stretch gap-0.5 rounded-full border border-nav-foreground/10 bg-nav/95 p-1.5 shadow-float backdrop-blur-xl min-[360px]:h-[5.125rem] min-[360px]:gap-1 min-[360px]:p-2 sm:h-[5.375rem] sm:gap-1.5">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex min-w-0 items-stretch justify-center">
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              tabIndex={hidden ? -1 : undefined}
              className="press group flex h-full w-full min-w-0 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-full bg-transparent px-0.5 text-nav-foreground/75 outline-none transition-[background-color,color,box-shadow] duration-300 ease-out focus-visible:ring-2 focus-visible:ring-primary min-[360px]:gap-1 sm:px-1"
              activeProps={{
                className: "bg-primary text-primary-foreground shadow-raised",
              }}
            >
              {({ isActive }) => (
                <>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full min-[360px]:size-8 sm:size-9">
                    <Icon
                      className="size-5 transition-transform duration-300 group-hover:scale-105 min-[360px]:size-[1.35rem] sm:size-6"
                      strokeWidth={isActive ? 2.1 : 1.7}
                    />
                  </span>
                  <span className="text-display block w-full overflow-hidden text-center text-[0.5625rem] leading-none font-bold whitespace-nowrap min-[360px]:text-[0.625rem] min-[400px]:text-[0.6875rem] sm:text-xs">
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
