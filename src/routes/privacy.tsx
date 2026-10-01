import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";

// Troque pelo e-mail real de contato antes de publicar na Play Store.
const CONTACT_EMAIL = "contato@thematches.com.br";
const UPDATED_AT = "1 de outubro de 2026";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — The Matches" },
      {
        name: "description",
        content:
          "Saiba como o The Matches coleta, usa e protege seus dados: conta, localização, fotos e avaliações do futebol amador.",
      },
      { property: "og:title", content: "Política de Privacidade — The Matches" },
      {
        property: "og:description",
        content: "Como o The Matches coleta, usa e protege os dados dos seus jogadores.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-display text-lg font-bold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground [&_a]:font-semibold [&_a]:text-primary [&_a]:underline">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="dark min-h-dvh bg-background text-foreground">
      <main className="mx-auto max-w-2xl px-4 pt-10 pb-16">
        <Link to="/auth" className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
          ← Voltar
        </Link>
        <div className="mt-6 flex items-center gap-3">
          <img src="/logo.webp" alt="The Matches" className="size-12 rounded-xl border border-border object-cover" />
          <div>
            <p className="text-display text-2xl font-extrabold text-foreground">The Matches</p>
            <p className="text-xs text-muted-foreground">Política de Privacidade</p>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Última atualização: {UPDATED_AT}</p>

        <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
          Esta Política de Privacidade explica como o aplicativo <strong className="text-foreground">The Matches</strong> ("nós", "aplicativo") coleta, usa, armazena e compartilha informações quando você cria uma conta, participa de partidas, avalia jogadores ou utiliza qualquer outra funcionalidade. Ao usar o aplicativo, você concorda com esta política.
        </p>

        <Section title="1. Quem somos">
          <p>
            O The Matches é uma plataforma de futebol amador e de várzea que permite encontrar partidas próximas em um mapa, organizar times, agendar confrontos entre equipes, registrar placares e avaliações, e acompanhar rankings locais, estaduais e globais.
          </p>
        </Section>

        <Section title="2. Dados que coletamos">
          <p><strong className="text-foreground">a) Dados da conta e do perfil.</strong> Ao criar sua conta, coletamos e armazenamos o e-mail informado, a senha (armazenada apenas em forma criptografada), o nome completo, o apelido de quadra, a cidade e o estado (UF), e a foto de perfil que você escolher enviar ou selecionar. Sua senha nunca fica visível para ninguém, nem para nós.</p>
          <p><strong className="text-foreground">b) Localização (GPS).</strong> Com a sua autorização, o aplicativo acessa a localização do seu dispositivo para: mostrar partidas e quadras próximas de você, sugerir partidas do seu bairro ou cidade, e validar sua presença em uma partida (check-in por GPS usado para liberar o direito de avaliar). A localização é usada apenas enquanto o aplicativo está aberto; não rastreamos seus movimentos em segundo plano.</p>
          <p><strong className="text-foreground">c) Conteúdo criado por você.</strong> Partidas criadas, times e escudos enviados, participação em partidas, placares reportados, gols, cartões e substituições registrados, e avaliações (notas de 1 a 5 estrelas) dadas a outros jogadores.</p>
          <p><strong className="text-foreground">d) Dados técnicos.</strong> Informações necessárias ao funcionamento, como sessão de acesso (login) e preferências locais guardadas no seu próprio dispositivo (por exemplo, se você já viu as telas de introdução ou quais notificações já abriu).</p>
        </Section>

        <Section title="3. Como usamos os dados">
          <p>
            Usamos seus dados para: criar e manter sua conta; exibir seu perfil, notas e estatísticas no aplicativo; mostrar partidas próximas com base na sua localização; validar presença e habilitar avaliações; gerenciar times, convites e confrontos; calcular rankings; e melhorar a experiência do aplicativo. Não usamos seus dados para publicidade direcionada e não vendemos seus dados.
          </p>
        </Section>

        <Section title="4. Com quem os dados são compartilhados">
          <p><strong className="text-foreground">Dentro do aplicativo.</strong> Seu nome (ou apelido), foto, cidade, time, notas e estatísticas ficam visíveis para outros usuários — isso é parte essencial do app, que funciona como vitrine pública de jogadores para peladas e olheiros. O e-mail e a senha nunca são exibidos para outros usuários.</p>
          <p><strong className="text-foreground">Provedores de infraestrutura.</strong> Os dados são armazenados em servidores de nuvem (banco de dados, autenticação e armazenamento de imagens) operados por fornecedores contratados para manter o aplicativo funcionando. Esses fornecedores atuam apenas sob instruções nossas, conforme contratos de proteção de dados.</p>
          <p><strong className="text-foreground">Exigências legais.</strong> Poderemos divulgar dados se exigido por lei, ordem judicial ou autoridade competente.</p>
        </Section>

        <Section title="5. Armazenamento e segurança">
          <p>
            Os dados ficam armazenados em servidores seguros com controle de acesso por linha (Row Level Security), o que garante, por exemplo, que apenas você possa editar seu perfil, e que apenas o criador de uma partida ou o juiz de um confronto possam alterar resultados. Fotos enviadas são comprimidas antes do envio e servidas por endereços públicos (URL) para exibição no aplicativo. Não há transmission de dados de pagamento, pois o aplicativo não realiza cobranças.
          </p>
        </Section>

        <Section title="6. Seus direitos (LGPD)">
          <p>
            Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode: confirmar a existência de tratamento dos seus dados; acessá-los e corrigi-los (diretamente no app, em Perfil → Editar); solicitar a anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desacordo com a lei; pedir a portabilidade; revogar o consentimento (por exemplo, negando o acesso à localização nas configurações do dispositivo); e pedir informações sobre com quem compartilhamos seus dados. Para exercer qualquer direito, entre em contato pelo e-mail indicado no item 10.
          </p>
        </Section>

        <Section title="7. Retenção e exclusão">
          <p>
            Mantemos seus dados enquanto sua conta existir e for necessária para o funcionamento do aplicativo (perfil, notas, estatísticas e histórico de partidas). Você pode solicitar a exclusão da sua conta e dos dados associados pelo e-mail de contato; após a exclusão, seu perfil, suas fotos e seus dados pessoais são removidos, podendo permanecer apenas informações agregadas que não identificam você.
          </p>
        </Section>

        <Section title="8. Menores de idade">
          <p>
            O The Matches não é destinado a menores de 13 anos. Não coletamos intencionalmente dados de crianças. Se você acredita que uma criança criou conta, entre em contato para que removamos os dados.
          </p>
        </Section>

        <Section title="9. Alterações desta política">
          <p>
            Esta política pode ser atualizada para refletir mudanças no aplicativo ou na legislação. Publicaremos sempre a versão vigente nesta página, com a data de atualização no topo.
          </p>
        </Section>

        <Section title="10. Contato">
          <p>
            Dúvidas, solicitações ou reclamações sobre privacidade podem ser enviadas para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Você também pode recorrer à Autoridade Nacional de Proteção de Dados (ANPD).
          </p>
        </Section>

        <p className="mt-10 text-center text-[11px] text-muted-foreground">
          The Matches — futebol de várzea ao vivo. <Link to="/auth" className="text-primary">Entrar no app</Link>
        </p>
      </main>
    </div>
  );
}
