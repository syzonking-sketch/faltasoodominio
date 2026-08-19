import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PlayerAvatar } from "@/components/app/player-avatar";
import { FieldError } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { signInSchema, signUpSchema, type SignInValues, type SignUpValues } from "@/lib/schemas";
import { friendlyError, isSupabaseConfigured, supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar no The Match — Futebol de várzea ao vivo" },
      {
        name: "description",
        content:
          "Crie sua conta no The Match e encontre peladas ao vivo perto de você, avalie jogadores e dispute o ranking da várzea.",
      },
      { property: "og:title", content: "Entrar no The Match" },
      {
        property: "og:description",
        content: "A plataforma do futebol amador em tempo real: radar de partidas, times e ranking.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) void navigate({ to: "/", replace: true });
  }, [loading, session, navigate]);

  const signIn = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const signUp = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      full_name: "",
      nickname: "",
      avatar_url: "",
      city: "",
      state: "",
      email: "",
      password: "",
    },
  });

  const avatarPreview = signUp.watch("avatar_url");
  const nicknamePreview = signUp.watch("nickname");

  async function handleSignIn(values: SignInValues) {
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword(values);
    setSubmitting(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    toast.success("Bola rolando! Bem-vindo de volta.");
    void navigate({ to: "/", replace: true });
  }

  async function handleSignUp(values: SignUpValues) {
    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.full_name,
          nickname: values.nickname,
          avatar_url: values.avatar_url,
          city: values.city,
          state: values.state.toUpperCase(),
        },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    if (!data.session) {
      toast.success("Conta criada! Você já pode entrar em campo.");
      return;
    }
    toast.success("Carteira do boleiro criada. Boa sorte!");
    void navigate({ to: "/", replace: true });
  }

  return (
    <div className="bg-field flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <span className="text-display inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            A Elite da Várzea
          </span>
          <h1 className="text-display mt-4 text-6xl leading-none font-extrabold tracking-tight text-foreground italic">
            THE <span className="text-primary">MATCH</span>
          </h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Radar Pro · Notas Reais · Ranking Elite
          </p>
        </div>

        {!isSupabaseConfigured ? (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-accent" />
            <p className="text-xs text-foreground">
              Falta a chave pública do seu projeto Supabase. Preencha
              <code className="mx-1 rounded bg-surface-2 px-1">VITE_SUPABASE_ANON_KEY</code>
              para liberar login e dados.
            </p>
          </div>
        ) : null}

        <div className="card-glow rounded-3xl border border-border bg-card p-5">
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-5">
              <form className="space-y-4" onSubmit={signIn.handleSubmit(handleSignIn)}>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" autoComplete="email" {...signIn.register("email")} />
                  <FieldError message={signIn.formState.errors.email?.message} />
                </div>
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    {...signIn.register("password")}
                  />
                  <FieldError message={signIn.formState.errors.password?.message} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  CONVOCAR JOGADOR
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-5">
              <form className="space-y-4" onSubmit={signUp.handleSubmit(handleSignUp)}>
                <div className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4 border border-border/50">
                  <div className="flex items-center gap-4">
                    <PlayerAvatar
                      name={signUp.watch("full_name") || "Novo boleiro"}
                      nickname={nicknamePreview}
                      photoUrl={avatarPreview}
                      size="xl"
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-foreground">Sua Identidade Visual</p>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Plataforma premium não usa avatar genérico. Cole o link de uma foto real sua para ser reconhecido na elite.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <Label htmlFor="avatar_url">Foto de perfil (URL)</Label>
                  <Input id="avatar_url" placeholder="https://..." {...signUp.register("avatar_url")} />
                  <FieldError message={signUp.formState.errors.avatar_url?.message || "Cole o link de uma foto real (https://...)"} />
                </div>
                <div>
                  <Label htmlFor="full_name">Nome completo</Label>
                  <Input id="full_name" {...signUp.register("full_name")} />
                  <FieldError message={signUp.formState.errors.full_name?.message} />
                </div>
                <div>
                  <Label htmlFor="nickname">Apelido de quadra</Label>
                  <Input id="nickname" placeholder="Ronaldinho da Vila" {...signUp.register("nickname")} />
                  <FieldError message={signUp.formState.errors.nickname?.message} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input id="city" {...signUp.register("city")} />
                    <FieldError message={signUp.formState.errors.city?.message} />
                  </div>
                  <div>
                    <Label htmlFor="state">UF</Label>
                    <Input id="state" maxLength={2} placeholder="SP" {...signUp.register("state")} />
                    <FieldError message={signUp.formState.errors.state?.message} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="signup-email">E-mail</Label>
                  <Input id="signup-email" type="email" {...signUp.register("email")} />
                  <FieldError message={signUp.formState.errors.email?.message} />
                </div>
                <div>
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    {...signUp.register("password")}
                  />
                  <FieldError message={signUp.formState.errors.password?.message} />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                  REGISTRAR NO ELENCO
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}