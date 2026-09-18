# Central Promo Pet

Landing de promoções para pets, com API, PostgreSQL e primeiro acesso administrativo.
Base derivada do Agrisense: Next.js/React, Express/TypeScript, Drizzle, npm workspaces,
Docker, Tilt, Helm e GitHub Actions/GHCR/Argo CD.

## Rodar localmente

Requisitos: Node.js 22+, npm, Docker Desktop com Kubernetes local habilitado, Tilt,
Helm e kubectl. Selecione um contexto Kubernetes local (por exemplo docker-desktop).

```sh
make install
make up
```

- Landing: http://localhost:3001
- API: http://localhost:4001/health
- Banco: localhost:5433 (usuário, senha e banco: `centralpromopet`, apenas local)
- Tilt: http://localhost:10350

O Tilt cria o namespace `centralpromopet`, sobe PostgreSQL, aplica migrations e cria
um admin local de forma idempotente antes de iniciar API e Web. As portas não
conflitam com os forwards padrão do Agrisense; para dois Tilts simultâneos, use
`tilt up --port 10351` no segundo projeto.

**Primeiro login local:** `admin@centralpromopet.local` / `CentralPet-local-2026!`.
A troca da senha é obrigatória antes de acessar conta e administração. O seed não
sobrescreve senhas já alteradas. Nenhuma dessas credenciais é usada no staging.

`make down` para o ambiente; `make dev` executa down/up como no Agrisense.
O PostgreSQL local usa armazenamento efêmero por padrão: `down` pode apagar os dados.
Staging usa volume persistente. `make studio` abre o Drizzle Studio.

## Escopo entregue

- Landing responsiva com logo original e link atual do grupo no WhatsApp via Busqy.
- `GET /api/promotions/today`: até 100 ofertas publicadas e válidas no instante da
  consulta (`startsAt <= agora < endsAt`). Datas armazenadas em UTC/timestamptz;
  apresentação em `America/Sao_Paulo`, moeda BRL, preços inteiros em centavos.
- Banco inicialmente sem ofertas; `make seed-demo` adiciona uma oferta explicitamente
  demonstrativa, somente em desenvolvimento. Cadastro/edição fica para a próxima fase.
- Login, logout, consulta da sessão e troca de senha; áreas iniciais de conta/admin.
- JWT em cookie HttpOnly/SameSite=Lax, Secure em produção; hash bcrypt; invalidação
  das sessões antigas após trocar senha; validação de JSON/origem e limite de tentativas.
- API interna com proxy `/api` no Next.js; proteção de autenticação, senha temporária
  e papel admin no backend. Não há token secreto exposto no frontend.
- Health checks, containers sem root para API/Web e estrutura de GitOps.

Próximas etapas: gestão de promoções, cadastro de clientes e pets, recuperação de
senha real e chat com IA consultando o catálogo. Não há chat/IA ou cadastro público
funcional nesta fase.

## Comandos e verificações

```sh
make check                 # lint + builds + testes unitários
make helm-lint             # renderização e validação local/staging
make migrate               # aplica migrations locais
make seed                  # cria o admin local se ainda não existir
make seed-demo             # promoção demonstrativa opcional
```

Os testes de integração requerem um banco separado e aplicam migrations nele:

```sh
TEST_DATABASE_URL=postgres://usuario:senha@localhost:5433/centralpromopet_test make test-integration
```

CI usa um PostgreSQL descartável para verificar login, autorização, troca obrigatória,
invalidação da sessão antiga e filtragem das promoções. Nunca aponte testes para
um banco de produção. `packages/database/drizzle` contém as migrations versionadas.

Para trabalhar fora do Tilt, use DATABASE_URL/JWT_SECRET/APP_ORIGINS na API e API_URL
no Web, conforme `.env.example`. Variáveis precisam ser exportadas para os processos;
o exemplo na raiz não é automaticamente lido pelo Next.js dentro do workspace.

## Staging

Estrutura preparada em [docs/staging.md](docs/staging.md). Provisionamento no Hetzner
fica para a próxima etapa. O workflow de publicação só roda após configurar
`STAGING_ENABLED=true`. Host de staging: `centralpromopet-stg.sabialabs.de`.

## Marca

Logo copiado do site atual: `apps/centralpromopet-web/public/logo.webp`.
Origem: https://centralpromopet.com.br/wp-content/uploads/2026/08/promo-pet-logo-sem-fd-laranja-1.webp
Link do grupo preservado: https://busqy.me/grupos/centralpromopet (configuração em
`apps/centralpromopet-web/lib/site.ts`).

## Ajustes de segurança em relação à base

Next.js foi atualizado para 16.3.5 e Drizzle ORM/Kit para 0.45.2/0.31.10.
O override de esbuild em package.json corrige a dependência de desenvolvimento
herdada pelo Drizzle Kit; mantenha a geração de migrations validada ao atualizá-lo.
Referências: [Next.js](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4),
[Drizzle](https://github.com/advisories/GHSA-gpj5-g38j-94v9) e
[esbuild](https://github.com/advisories/GHSA-67mh-4wv8-2f99).
