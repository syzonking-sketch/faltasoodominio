import { Link } from "@tanstack/react-router";
import { MapPin, Trophy, User, Users } from "lucide-react";

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
      <ul className="mx-auto grid max-w-md grid-cols-5 items-center rounded-full bg-black px-3 py-3.5 shadow-[0_14px_34px_-12px_oklch(0.1_0.01_150/0.7)]">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="press group flex flex-col items-center gap-1.5 rounded-full px-1 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex size-12 items-center justify-center rounded-full transition-all duration-200 ease-out ${
                      isActive
                        ? "scale-110 bg-white text-black shadow-[0_0_0_4px_rgb(255_255_255/0.12)]"
                        : "text-white"
                    }`}
                  >
                    <Icon className="size-7" strokeWidth={isActive ? 1.7 : 1.6} />
                  </span>
                  <span
                    className={`text-display text-[11px] leading-none font-black tracking-wide ${
                      isActive
                        ? "border-b-[2.5px] border-white pb-0.5 text-white"
                        : "pb-[3.5px] text-white/80"
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
