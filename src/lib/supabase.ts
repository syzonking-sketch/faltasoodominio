import { createClient } from "@supabase/supabase-js";

const url = "https://odjgylxayhluepjbiqxi.supabase.co";
// Note: We use the key provided by the user in the context of the conversation
const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kamd5bHhheWhsdWVwamJpcXhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjc3MTMsImV4cCI6MjEwMjY0MzcxM30.eSxe2rVWhymG2EfCOa1cjp7GKz5MB3s6Nbm9V8GaZ0U";

/** False when the project env vars are not filled in yet. */
export const isSupabaseConfigured = true;

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
  if (/Email not confirmed/i.test(message)) return "E-mail não confirmado. Verifique sua caixa de entrada.";
  if (/rate limit/i.test(message)) return "Muitas tentativas. Aguarde um momento e tente novamente.";
  if (/Password should be/i.test(message)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/duplicate key/i.test(message)) return "Esse registro já existe.";
  if (/row-level security/i.test(message)) return "Você não tem permissão para essa ação.";
  if (/Failed to fetch|NetworkError/i.test(message)) return "Sem conexão com a internet. Tente novamente.";
  return message || "Algo deu errado. Tente novamente.";
}