import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().min(1, "Informe seu e-mail").email("E-mail inválido"),
  password: z.string().min(6, "Mínimo de 6 caracteres"),
});
export type SignInValues = z.infer<typeof signInSchema>;

export const signUpSchema = z.object({
  full_name: z.string().min(3, "Informe seu nome completo"),
  nickname: z.string().min(2, "Apelido de quadra é obrigatório").max(24, "Máximo 24 caracteres"),
  avatar_url: z.string().url("Cole o link de uma foto real (https://...)"),
  city: z.string().min(2, "Informe sua cidade"),
  state: z.string().length(2, "Use a sigla do estado (ex: SP)"),
  email: z.string().min(1, "Informe seu e-mail").email("E-mail inválido"),
  password: z.string().min(6, "Mínimo de 6 caracteres"),
});
export type SignUpValues = z.infer<typeof signUpSchema>;

export const profileSchema = z.object({
  full_name: z.string().min(3, "Informe seu nome completo"),
  nickname: z.string().min(2, "Apelido obrigatório").max(24),
  avatar_url: z.string().url("Informe o link de uma foto real"),
  city: z.string().min(2, "Informe sua cidade"),
  state: z.string().length(2, "Sigla do estado (ex: SP)"),
});
export type ProfileValues = z.infer<typeof profileSchema>;

export const venueSchema = z.object({
  name: z.string().min(3, "Nome da quadra"),
  address: z.string().min(3, "Endereço de referência"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type VenueValues = z.infer<typeof venueSchema>;

export const newMatchSchema = z.object({
  venue_id: z.string().uuid("Selecione uma quadra no mapa"),
  match_type: z.enum(["pelada", "campeonato"]),
  role: z.enum(["player", "spectator"]),
  team_side: z.enum(["A", "B"]),
});
export type NewMatchValues = z.infer<typeof newMatchSchema>;

export const teamSchema = z.object({
  name: z.string().min(3, "Nome do time"),
  shield_url: z.string().url("Link do escudo (https://...)"),
  city: z.string().min(2, "Cidade"),
  state: z.string().length(2, "Sigla do estado"),
});
export type TeamValues = z.infer<typeof teamSchema>;

export const confrontoSchema = z.object({
  team_a_id: z.string().uuid("Selecione seu time"),
  team_b_id: z.string().uuid("Selecione o adversário"),
  venue_id: z.string().uuid("Selecione a quadra").optional(),
  scheduled_at: z.string().min(1, "Escolha data e hora"),
});
export type ConfrontoValues = z.infer<typeof confrontoSchema>;

export const scoreSchema = z.object({
  score_a: z.coerce.number().int().min(0, "Placar inválido").max(99),
  score_b: z.coerce.number().int().min(0, "Placar inválido").max(99),
});
export type ScoreValues = z.infer<typeof scoreSchema>;