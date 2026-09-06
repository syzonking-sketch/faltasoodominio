import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { ensureCurrentProfile } from "./api";
import { supabase } from "./supabase";
import type { Profile } from "./types";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  refetchProfile: () => Promise<any>;
  loading: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  profileLoading: false,
  refetchProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
      
      if (event === "SIGNED_OUT") {
        queryClient.clear();
      }
      
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        if (nextSession?.user.id) {
          // O callback de autenticação precisa terminar antes de fazer outra
          // chamada ao cliente; caso contrário, o bloqueio interno da sessão
          // pode deixar a página de perfil carregando indefinidamente.
          window.setTimeout(() => {
            void ensureCurrentProfile().then(() => {
              if (mounted) {
                void queryClient.invalidateQueries({ queryKey: ["profile", nextSession.user.id] });
              }
            });
          }, 0);
        }
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [queryClient]);

  const userId = session?.user.id ?? null;

  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    staleTime: 0, // Force fresh data when profile is missing
    queryFn: async (): Promise<Profile | null> => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        console.log("AuthProvider: Perfil não encontrado, tentando criar...");
        // Fallback: try to ensure profile exists if missing
        await ensureCurrentProfile();
        const { data: retriedData, error: retryError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        
        if (retryError) {
          console.error("AuthProvider: Erro na segunda tentativa de buscar perfil:", retryError);
          throw retryError;
        }
        
        return (retriedData as Profile | null) ?? null;
      }

      return (data as Profile | null) ?? null;
    },
  });

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile: profile ?? null,
    loading,
    profileLoading,
    refetchProfile,
    signOut: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
    },
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  return use(AuthContext);
}