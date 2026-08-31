import { Link } from "@tanstack/react-router";
import { Radar, Swords, Trophy, User, Users } from "lucide-react";

const tabs = [
  { to: "/", label: "Radar", icon: Radar },
  { to: "/matches", label: "Partidas", icon: Swords },
  { to: "/teams", label: "Times", icon: Users },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-500 border-t border-border/70 bg-background"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5 px-2 pt-2">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="press group flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 ease-out ${
                      isActive
                        ? "bg-primary text-primary-foreground scale-105"
                        : "bg-surface-2 text-muted-foreground"
                    }`}
                  >
                    <Icon className="size-7" strokeWidth={isActive ? 2.4 : 1.9} />
                  </span>
                  <span
                    className={`text-[11px] font-semibold tracking-wide transition-colors duration-200 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {label}
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
