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
      className="pb-safe fixed inset-x-0 bottom-0 z-500 border-t border-border bg-surface/95 backdrop-blur-lg"
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-5">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-col items-center gap-1 px-1 py-2.5 text-muted-foreground transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="size-5" />
              <span className="text-[11px] font-semibold tracking-wide">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}