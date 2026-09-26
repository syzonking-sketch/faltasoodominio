import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import footballImage from "@/assets/matches-hero.jpg";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PlayerAvatar, GENERIC_AVATARS } from "@/components/app/player-avatar";
import { FieldError } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { signInSchema, signUpSchema, type SignInValues, type SignUpValues } from "@/lib/schemas";
import { friendlyError, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/auth")({
  ssr: false,
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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

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

    if (error) {
      setSubmitting(false);
      toast.error(friendlyError(error));
      return;
    }

    // Manual profile insertion as a fallback in case the trigger fails or hasn't been set up yet
    if (data.user) {
      console.log("Tentando sincronização manual do perfil para:", data.user.id);
      
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: values.full_name,
        nickname: values.nickname,
        avatar_url: values.avatar_url,
        city: values.city,
        state: values.state.toUpperCase(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

      if (profileError) {
        console.error("Erro crítico na sincronização do perfil:", profileError);
        // Se houver erro de RLS (42501), avisamos o usuário que o perfil pode demorar
        if (profileError.code === '42501') {
          toast.warning("Conta criada, mas seu perfil pode demorar alguns segundos para aparecer devido às permissões do banco.");
        }
      } else {
        console.log("Perfil sincronizado com sucesso.");
      }
    }

    setSubmitting(false);
    if (!data.session) {
      toast.success("Conta criada! Verifique seu e-mail para confirmar o acesso.");
      return;
    }
    toast.success("Carteira do boleiro criada. Boa sorte!");
    void navigate({ to: "/", replace: true });
  }

  return (
    <div className="dark flex min-h-dvh items-center justify-center bg-nav text-foreground md:p-6">
      <main className="relative isolate flex min-h-dvh w-full max-w-[420px] flex-col overflow-hidden bg-background md:min-h-[min(780px,calc(100dvh-48px))] md:rounded-[32px] md:border md:border-border md:shadow-2xl">
        <img src={footballImage} alt="" className="pointer-events-none absolute inset-0 -z-20 size-full object-cover object-[center_40%]" />
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background/35 via-background/55 to-background" />

        <header className="flex flex-col items-start px-7 pt-[clamp(54px,11dvh,102px)] pb-9 sm:px-8">
          <div className="flex items-center gap-3">
            <img src="/logo.webp" alt="TM" className="size-12 shrink-0 rounded-xl object-cover" />
            <span className="text-display text-[25px] font-extrabold leading-none text-foreground">THE MATCH</span>
          </div>
          <p className="mt-2 text-[10px] font-bold uppercase text-foreground/80">RADAR PRO · NOTAS REAIS · RANKING ELITE</p>
        </header>

        <section className="mt-auto rounded-t-[28px] border-t border-border/70 bg-background/90 px-6 pt-6 pb-[max(28px,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-7 md:rounded-b-[32px]">
          <h1 className="text-display text-[38px] leading-[0.95] font-extrabold italic text-foreground sm:text-[42px]">
            ENTRE NO<br /><span className="text-primary">THE MATCH</span>
          </h1>
          <p className="mt-2 text-xs text-foreground/85">Encontre sua próxima partida.</p>

          {!isSupabaseConfigured ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-accent/40 bg-accent/10 p-3">
              <ShieldAlert className="size-4 shrink-0 text-accent" />
              <p className="text-xs">Conexão com o servidor não configurada.</p>
            </div>
          ) : null}

          <Tabs defaultValue="signin" className="mt-5">
            <TabsList className="grid h-10 w-full grid-cols-2 rounded-full border border-border bg-surface-2 p-0.5">
              <TabsTrigger value="signin" className="h-full rounded-full text-xs font-medium text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="h-full rounded-full text-xs font-medium text-muted-foreground shadow-none data-[state=active]:bg-primary data-[state=active]:font-semibold data-[state=active]:text-primary-foreground">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-4">
              <form className="space-y-3" onSubmit={signIn.handleSubmit(handleSignIn)}>
                <div>
                  <Label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-foreground">E-mail</Label>
                  <div className="relative">
                    <Mail aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="email" type="email" autoComplete="email" placeholder="seu@email.com" className="h-11 rounded-full border-border bg-surface-2/90 pl-11 text-[16px] placeholder:text-muted-foreground focus-visible:ring-primary" {...signIn.register("email")} />
                  </div>
                  <FieldError message={signIn.formState.errors.email?.message} />
                </div>
                <div>
                  <Label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-foreground">Senha</Label>
                  <div className="relative">
                    <LockKeyhole aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="password" type={showSignInPassword ? "text" : "password"} autoComplete="current-password" placeholder="Digite sua senha" className="h-11 rounded-full border-border bg-surface-2/90 pr-11 pl-11 text-[16px] placeholder:text-muted-foreground focus-visible:ring-primary" {...signIn.register("password")} />
                    <Button type="button" variant="ghost" size="icon" aria-label={showSignInPassword ? "Ocultar senha" : "Mostrar senha"} title={showSignInPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowSignInPassword((value) => !value)} className="absolute top-1/2 right-1.5 size-9 -translate-y-1/2 rounded-full text-muted-foreground hover:bg-transparent hover:text-foreground">
                      {showSignInPassword ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                  <FieldError message={signIn.formState.errors.password?.message} />
                </div>
                <Button type="submit" className="mt-4 h-12 w-full rounded-full text-sm font-bold" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" /> : null}ENTRAR
                </Button>
              </form>
              <p className="mt-4 text-center text-xs text-muted-foreground">Ainda não tem conta? <TabsTrigger value="signup" className="h-auto p-0 font-bold text-primary shadow-none hover:text-primary/80 data-[state=active]:bg-transparent">Criar conta</TabsTrigger></p>
            </TabsContent>

            <TabsContent value="signup" className="mt-4">
              <form className="space-y-3" onSubmit={signUp.handleSubmit(handleSignUp)}>
                <div>
                  <Label htmlFor="full_name" className="mb-1 block text-xs font-semibold">Nome completo</Label>
                  <Input id="full_name" autoComplete="name" className="h-10 rounded-full bg-surface-2/90 px-4 text-[16px]" {...signUp.register("full_name")} />
                  <FieldError message={signUp.formState.errors.full_name?.message} />
                </div>
                <div>
                  <Label htmlFor="nickname" className="mb-1 block text-xs font-semibold">Apelido de quadra</Label>
                  <Input id="nickname" placeholder="Ronaldinho da Vila" className="h-10 rounded-full bg-surface-2/90 px-4 text-[16px]" {...signUp.register("nickname")} />
                  <FieldError message={signUp.formState.errors.nickname?.message} />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_72px] gap-3">
                  <div className="min-w-0"><Label htmlFor="city" className="mb-1 block text-xs font-semibold">Cidade</Label><Input id="city" className="h-10 rounded-full bg-surface-2/90 px-4 text-[16px]" {...signUp.register("city")} /><FieldError message={signUp.formState.errors.city?.message} /></div>
                  <div><Label htmlFor="state" className="mb-1 block text-xs font-semibold">UF</Label><Input id="state" maxLength={2} placeholder="SP" className="h-10 rounded-full bg-surface-2/90 px-4 text-[16px]" {...signUp.register("state")} /><FieldError message={signUp.formState.errors.state?.message} /></div>
                </div>
                <div>
                  <Label htmlFor="signup-email" className="mb-1 block text-xs font-semibold">E-mail</Label>
                  <div className="relative"><Mail aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="signup-email" type="email" autoComplete="email" placeholder="seu@email.com" className="h-10 rounded-full bg-surface-2/90 pr-4 pl-11 text-[16px]" {...signUp.register("email")} /></div>
                  <FieldError message={signUp.formState.errors.email?.message} />
                </div>
                <div>
                  <Label htmlFor="signup-password" className="mb-1 block text-xs font-semibold">Senha</Label>
                  <div className="relative"><LockKeyhole aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="signup-password" type={showSignUpPassword ? "text" : "password"} autoComplete="new-password" className="h-10 rounded-full bg-surface-2/90 pr-11 pl-11 text-[16px]" {...signUp.register("password")} /><Button type="button" variant="ghost" size="icon" aria-label={showSignUpPassword ? "Ocultar senha" : "Mostrar senha"} title={showSignUpPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowSignUpPassword((value) => !value)} className="absolute top-1/2 right-1 size-8 -translate-y-1/2 rounded-full text-muted-foreground hover:bg-transparent hover:text-foreground">{showSignUpPassword ? <EyeOff /> : <Eye />}</Button></div>
                  <FieldError message={signUp.formState.errors.password?.message} />
                </div>
                <div className="rounded-xl border border-border bg-surface-2/70 p-3">
                  <div className="flex items-center gap-3">
                    <PlayerAvatar name={signUp.watch("full_name") || "Novo boleiro"} nickname={nicknamePreview} photoUrl={avatarPreview} size="md" />
                    <div><p className="text-xs font-semibold">Escolha seu avatar</p><p className="text-[11px] text-muted-foreground">Selecione um jogador ou use um link.</p></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {GENERIC_AVATARS.map((avatar) => (
                      <Button key={avatar.id} type="button" variant="ghost" size="icon" aria-label={avatar.label} aria-pressed={avatarPreview === avatar.url} onClick={() => signUp.setValue("avatar_url", avatar.url)} className={cn("size-9 rounded-full border-2 p-0", avatarPreview === avatar.url ? "border-primary" : "border-border")}>
                        <img src={avatar.url} alt="" className="size-full rounded-full object-cover" />
                      </Button>
                    ))}
                  </div>
                  <Label htmlFor="avatar_url" className="mt-3 mb-1 block text-[11px] text-muted-foreground">Ou cole um link de imagem</Label>
                  <Input id="avatar_url" placeholder="https://..." className="h-9 rounded-full bg-surface-2 px-4 text-xs" {...signUp.register("avatar_url")} />
                  <FieldError message={signUp.formState.errors.avatar_url?.message} />
                </div>
                <Button type="submit" className="mt-3 h-12 w-full rounded-full text-sm font-bold" disabled={submitting}>
                  {submitting ? <Loader2 className="animate-spin" /> : null}CRIAR CONTA
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  );
}