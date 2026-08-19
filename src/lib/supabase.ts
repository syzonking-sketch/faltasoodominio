import { createClient } from "@supabase/supabase-js";

const url = import.meta.env["VITE_SUPABASE_URL"] || "https://odjgylxayhluepjbiqxi.supabase.co";
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] || "";

/** False when the project env vars are not filled in yet. */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder-anon-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: "the-match-auth",
  },
});

export function friendlyError(error: unknown): string {
  if (!isSupabaseConfigured) {
    return "Conexão com o servidor não configurada. Adicione a chave pública do Supabase.";
  }
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/Invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
  if (/User already registered/i.test(message)) return "Este e-mail já está cadastrado.";
  if (/Password should be/i.test(message)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/duplicate key/i.test(message)) return "Esse registro já existe.";
  if (/row-level security/i.test(message)) return "Você não tem permissão para essa ação.";
  if (/Failed to fetch|NetworkError/i.test(message)) return "Sem conexão com a internet. Tente novamente.";
  return message || "Algo deu errado. Tente novamente.";
}