import { Link } from "@tanstack/react-router";
import { MapPin, Trophy, User, Users } from "lucide-react";

function BallIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
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
  { to: "/teams", label: "Times", icon: Users },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-500 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.6rem)]"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-center rounded-[2rem] bg-[oklch(0.17_0.005_150)] px-2 py-3 shadow-[0_10px_30px_-12px_oklch(0.2_0.02_150/0.55)]">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="press group flex flex-col items-center gap-1.5 rounded-2xl px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex size-11 items-center justify-center rounded-full transition-all duration-200 ease-out ${
                      isActive ? "scale-105 bg-white text-[oklch(0.17_0.005_150)]" : "text-white/85"
                    }`}
                  >
                    <Icon className="size-6" />
                  </span>
                  <span
                    className={`text-display text-[10px] leading-none font-bold tracking-wider ${
                      isActive
                        ? "border-b-2 border-white pb-0.5 text-white"
                        : "pb-[3px] text-white/70"
                    }`}
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
