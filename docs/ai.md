# Assistente Central

## Fluxo e configuração

O chat exige sessão autenticada com senha atualizada. Admins configuram o serviço em
`/dashboard/admin/ai`; as mesmas permissões são verificadas na API. O padrão é IA
desativada, Vertex AI Express `gemini-2.5-flash-lite`, ofertas cadastradas nos últimos 30 dias,
8 resultados e 40 mensagens por usuário/dia (UTC). OpenAI `gpt-5-mini` é o segundo
provedor. Modelos são permitidos por uma lista explícita, sem URLs arbitrárias.

Salvar com IA ativada testa uma chamada real. `Testar conexão` verifica o formulário
sem salvar. Os testes de conexão têm limite de 30 chamadas/admin/dia. Uma conversa
consome até duas chamadas do modelo: planejar ferramentas e compor resposta/resumo.
Há timeout de 45 segundos por chamada e limite de 3000 tokens de saída por chamada.
Configurações e rotação de credenciais geram auditoria sem valores secretos.

## Autenticação dos provedores

O administrador cadastra pela própria tela a chave do provedor selecionado: uma
API key do Vertex AI Express para Gemini ou uma API key de projeto da OpenAI. A chave é enviada somente
à API autenticada, criptografada com AES-256-GCM antes de ser gravada e nunca é
devolvida ao navegador, incluída na auditoria ou registrada em logs. A tela informa
apenas se existe uma chave e permite substituí-la.

A criptografia usa `AI_CREDENTIAL_ENCRYPTION_KEY`; quando ela não existe, deriva a
chave do `JWT_SECRET` para facilitar o ambiente local. Em produção, prefira uma
chave independente, com no mínimo 32 caracteres, injetada no processo da API. Sua
rotação exige cadastrar novamente as chaves dos provedores. Não coloque esses
valores em variáveis `NEXT_PUBLIC`, valores Helm versionados ou logs.

Para Vertex, use a chave criada pelo modo Express do Google Cloud; esse modo autentica
pela chave e não exige projeto/localização no endpoint. Para OpenAI, use uma chave de projeto dedicada;
assinatura ChatGPT não substitui credenciais ou faturamento da API.

## LangGraph e memória

Grafo: carregar contexto → planejar ferramentas → buscar promoções → responder e
resumir. Estado persistido com PostgresSaver. Tabelas de checkpoints ficam no schema
`ai_checkpoints`, provisionadas pela migração Drizzle 0011 (compatível com
langgraph-checkpoint-postgres 1.0.5); não se executa setup/db:push no startup.

Ao reabrir o chat começa uma sessão nova. O contexto traz cadastro atual de pets,
até 12 memórias relevantes (saúde priorizada), resumo da sessão e 6 mensagens
recentes (até 1500 caracteres cada). No primeiro turno de uma sessão, recupera até
2 resumos anteriores (1000 caracteres cada). Nada de histórico completo no prompt.
O cadastro atual prevalece; inscrição newsletter é conhecida pelo agente.

O assistente pergunta cedo se a compra é para cão/gato, coleta nome naturalmente,
propõe cadastro e oferece newsletter com consentimento separado. Ofertas são dados
publicados/ativos/válidos do PostgreSQL; `promotionsDays` compara `created_at`, não
`updated_at`. A resposta só pode selecionar IDs recuperados; preço/link/cupom são
renderizados em cards pelo servidor/frontend. Catálogo vazio gera orientação
amigável sobre o site novo e futuras integrações, sem resultados inventados.
Orientações de bem-estar vêm do conhecimento geral do modelo, não da tabela dicas.

Preferências, rotina e treinamento declarados são memorizados; saúde e ações de
cadastro exigem confirmação em um card. Ações ficam persistidas em `ai_actions`,
expiram em 24h e são executadas transacionalmente, uma só vez. Confirmação é uma
rota autenticada da aplicação, independente de continuar a thread do modelo.
Não é interpretado um “sim” arbitrário como autorização de exclusão. Toda tool é
restrita ao usuário da sessão; IDs sugeridos pelo modelo são validados.

Advisory locks PostgreSQL serializam turnos, decisões e exclusão de memória por
usuário, inclusive entre réplicas. Quotas também ficam no PostgreSQL. Não são
enviados e-mail, credenciais ou outros usuários ao modelo. Não há tracing externo
de conversas habilitado. OpenAI usa `store:false`; regras de retenção do provedor
devem ser verificadas na conta antes da ativação real.

## Exclusão e limitações

`/dashboard/memory` permite ver pets, memórias e resumos, continuar uma conversa ou
apagar dados. Apagar uma memória também limpa mensagens/resumos/checkpoints de
todas as conversas do usuário, avisando antes, para evitar que ela ressurja do
histórico. Outras memórias estruturadas permanecem. Apagar tudo não apaga pets nem
altera o opt-in de newsletter. Exclusão de pet pelo chat remove memórias por FK e
limpa contexto conversacional. Exclusão de uma thread remove checkpoints por trigger.

O fluxo registra a adesão à newsletter; não implementa serviço de disparo de e-mail.
Não há ferramentas externas de lojas, navegação web, fallback automático entre
provedores ou embeddings. Busca atual usa termos no catálogo local. Testes de
integração executam LangGraph e PostgreSQL reais com respostas de modelo simuladas;
após configurar credenciais, validar qualidade em português e custo com perguntas
reais pelo painel/chat antes de abrir o serviço ao público.

Referências: [OpenAI Responses](https://developers.openai.com/api/docs/guides/text),
[API keys no Google Cloud](https://docs.cloud.google.com/docs/authentication/api-keys-use),
[Vertex AI Express](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/express-mode/overview),
[LangGraph memória](https://docs.langchain.com/oss/javascript/langgraph/add-memory).
