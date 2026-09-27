import { useState } from "react";
import authImage from "@/assets/auth-football.jpg";
import matchesImage from "@/assets/matches-hero.jpg";
import radarImage from "@/assets/radar-football.jpg";
import { Button } from "@/components/ui/button";
import { GENERIC_AVATARS } from "@/components/app/player-avatar";
import { cn } from "@/lib/utils";

const PILL_AVATARS = GENERIC_AVATARS.slice(0, 3);

const SLIDES = [
  {
    image: authImage,
    pill: "JOGOS PERTO DE VOCÊ",
    title: ["ACHE O", "PRÓXIMO", "JOGO"],
    subtitle:
      "Descubra partidas no seu bairro, veja horários reais e entre em quadra quando quiser.",
  },
  {
    image: radarImage,
    pill: "NOTAS DE QUEM JOGOU",
    title: ["AVALIE", "QUEM", "JOGOU"],
    subtitle: "Dê notas de verdade depois do jogo e construa sua reputação na várzea.",
  },
  {
    image: matchesImage,
    pill: "DESTAQUES DA REGIÃO",
    title: ["SUBA NO", "RANKING", "DA VÁRZEA"],
    subtitle: "Evolua a cada partida e dispute o topo do ranking da sua região.",
  },
];

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index] ?? SLIDES[0]!;
  const isLast = index === SLIDES.length - 1;

  return (
    <div className="dark relative flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <img
        key={`img-${index}`}
        src={slide.image}
        alt=""
        className="onboarding-fade pointer-events-none absolute inset-0 size-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/45 via-background/5 to-background/90" />

      <header className="relative z-10 flex items-center justify-end px-6 pt-[max(18px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onFinish}
          className="rounded-full px-3 py-2 text-sm font-semibold text-foreground/90 transition hover:text-foreground"
        >
          Pular
        </button>
      </header>

      <div className="relative z-10 mt-auto flex flex-col px-6 pb-[max(28px,env(safe-area-inset-bottom))]">
        <div key={`content-${index}`} className="onboarding-fade flex flex-col items-center">
          <div className="flex items-center gap-2 rounded-full bg-black/45 py-1.5 pr-4 pl-2 ring-1 ring-white/15 backdrop-blur-sm">
            <div className="flex -space-x-2">
              {PILL_AVATARS.map((avatar) => (
                <img
                  key={avatar.id}
                  src={avatar.url}
                  alt=""
                  className="size-6 rounded-full border border-white/50 object-cover"
                />
              ))}
            </div>
            <span className="text-[11px] font-bold tracking-[0.08em] text-foreground/95">
              {slide.pill}
            </span>
          </div>

          <h1 className="text-display mt-5 text-center text-[44px] leading-[0.95] font-extrabold tracking-tight text-foreground">
            {slide.title.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>

          <p className="mt-4 max-w-[300px] text-center text-sm leading-relaxed text-foreground/85">
            {slide.subtitle}
          </p>
        </div>

        <div className="mt-7 flex items-center justify-center gap-1.5">
          {SLIDES.map((item, dotIndex) => (
            <button
              key={item.pill}
              type="button"
              aria-label={`Tela ${dotIndex + 1} de ${SLIDES.length}`}
              onClick={() => setIndex(dotIndex)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                dotIndex === index
                  ? "w-8 bg-foreground"
                  : "w-1.5 bg-foreground/40 hover:bg-foreground/60",
              )}
            />
          ))}
        </div>

        <Button
          type="button"
          onClick={() => (isLast ? onFinish() : setIndex((value) => value + 1))}
          className="mt-6 h-12 w-full rounded-full text-[15px] font-bold"
        >
          {isLast ? "Começar" : "Continuar"}
        </Button>
      </div>
    </div>
  );
}
