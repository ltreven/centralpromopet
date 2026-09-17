# Validação do bootstrap — 17/09/2026

Validado localmente, sem publicação no GitHub ou deploy no Hetzner:

- `npm run check`: lint Web, builds de API/Web, 3 testes unitários passando.
- `make test-integration` em PostgreSQL 15 descartável: bootstrap de admin único,
  hash de senha, login, troca obrigatória, invalidação das sessões anteriores,
  autorização por perfil, conta inativa, proteção de origem/JSON, ofertas válidas
  e logout; todos passando.
- Geração Drizzle sem diferença pendente de schema; migrations reaplicáveis.
- Helm local/staging validado; Tilt no contexto docker-desktop com os três pods
  saudáveis (PostgreSQL/API/Web), migrations e seed local concluídos.
- Login real via proxy Next.js verificado; a senha do admin local permanece
  temporária para que o usuário faça a primeira troca.
- Landing/WhatsApp/login conferidos em Chrome isolado; viewport mobile 390px sem
  overflow horizontal. Browser integrado indisponível nesta sessão.
- Imagens de produção API e Web construídas com Node 22; landing, logo e proxy
  `/api/promotions/today` respondendo no smoke test dos containers. O comando
  compilado de migrations do Job também foi executado com sucesso.
- Auditoria npm após atualização: zero vulnerabilidades reportadas.

O GitHub Actions ainda precisa executar no repositório remoto. DNS, TLS, secrets,
permissões de GHCR/promoção e reconciliação Argo CD serão validados ao preparar o
staging, conforme staging.md. Auditoria de dependências não substitui uma revisão
completa de segurança da aplicação.
