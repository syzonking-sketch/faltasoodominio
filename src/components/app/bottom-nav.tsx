import { Link } from "@tanstack/react-router";
import { Map, ListChecks, Shield, Trophy, User } from "lucide-react";

const tabs = [
  { to: "/", label: "Radar", icon: Map },
  { to: "/matches", label: "Partidas", icon: ListChecks },
  { to: "/teams", label: "Times", icon: Shield },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-500 border-t border-border/70 bg-surface/90 backdrop-blur-xl"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5 px-2 pt-1.5">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="press group flex flex-col items-center gap-1 rounded-2xl px-1 py-1.5 text-muted-foreground"
              activeProps={{ className: "text-primary" }}
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-8 w-12 items-center justify-center rounded-full transition-colors ${
                      isActive ? "bg-accent" : "bg-transparent"
                    }`}
                  >
                    <Icon className="size-5" strokeWidth={isActive ? 2.4 : 1.9} />
                  </span>
                  <span
                    className={`text-[11px] tracking-wide ${
                      isActive ? "font-bold" : "font-medium"
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
