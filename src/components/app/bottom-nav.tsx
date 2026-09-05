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

/** Mancha de tinta branca (spray / street art) centralizada atrás do ícone ativo. */
function PaintSplat({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <filter id="nav-splat-rough" x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0.055" numOctaves="3" seed="6" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="9" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="nav-splat-specks" x="-60%" y="-60%" width="220%" height="220%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" result="n2" />
          <feDisplacementMap in="SourceGraphic" in2="n2" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g fill="currentColor">
        {/* Blob principal simétrico em torno do centro (60,60) */}
        <g filter="url(#nav-splat-rough)">
          <circle cx="60" cy="60" r="36" />
          <ellipse cx="60" cy="26" rx="13" ry="9" />
          <ellipse cx="60" cy="94" rx="13" ry="9" />
          <ellipse cx="26" cy="60" rx="9" ry="13" />
          <ellipse cx="94" cy="60" rx="9" ry="13" />
          <ellipse cx="36" cy="36" rx="7" ry="6" />
          <ellipse cx="84" cy="84" rx="7" ry="6" />
          <ellipse cx="84" cy="36" rx="6" ry="7" />
          <ellipse cx="36" cy="84" rx="6" ry="7" />
        </g>
        {/* Respingos simétricos */}
        <g filter="url(#nav-splat-specks)" opacity="0.92">
          <circle cx="18" cy="30" r="2.8" />
          <circle cx="102" cy="90" r="2.8" />
          <circle cx="102" cy="30" r="2.4" />
          <circle cx="18" cy="90" r="2.4" />
          <circle cx="60" cy="10" r="2.2" />
          <circle cx="60" cy="110" r="2.2" />
          <circle cx="10" cy="60" r="1.9" />
          <circle cx="110" cy="60" r="1.9" />
        </g>
      </g>
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
      className="fixed inset-x-0 bottom-0 z-500 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.55rem)]"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end gap-1 rounded-[2.25rem] bg-black px-2 py-3 shadow-[0_18px_38px_-14px_oklch(0.1_0.01_150/0.75)]">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to} className="min-w-0">
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="press group flex flex-col items-center gap-1 rounded-2xl px-0.5 py-0.5 outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {({ isActive }) => (
                <>
                  {/* Container do ícone: centralização real via translate, funciona em qualquer tela */}
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center sm:h-12 sm:w-12">
                    <PaintSplat
                      className={`pointer-events-none absolute left-1/2 top-1/2 h-[3.8rem] w-[3.8rem] -translate-x-1/2 -translate-y-1/2 text-white transition-all duration-300 ease-out sm:h-[4.4rem] sm:w-[4.4rem] ${
                        isActive ? "scale-100 opacity-100" : "scale-75 opacity-0"
                      }`}
                    />
                    <Icon
                      className={`relative size-6 transition-colors duration-200 sm:size-7 ${
                        isActive ? "text-black" : "text-white"
                      }`}
                      strokeWidth={isActive ? 1.9 : 1.6}
                    />
                  </span>
                  <span
                    className={`text-display truncate text-[10px] leading-none font-black tracking-wide text-white transition-opacity duration-200 sm:text-[10.5px] ${
                      isActive ? "border-b-[2.5px] border-white pb-0.5 opacity-100" : "pb-[3.5px] opacity-70"
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
