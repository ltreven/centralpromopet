import { AiConfig, AiError, providerCredential } from './config';

export type ModelCall = (instructions: string, input: unknown) => Promise<unknown>;
async function request(url: string, init: RequestInit) {
  let response: Response;
  try { response = await fetch(url, { ...init, signal: AbortSignal.timeout(45000) }); }
  catch { throw new AiError('O provedor demorou para responder. Tente novamente.', 503); }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = body?.error?.code;
    if (response.status === 401 || code === 'invalid_api_key') throw new AiError('A chave de API foi recusada pelo provedor. Substitua por uma chave válida.', 503);
    if (response.status === 403) throw new AiError('A chave não tem permissão para usar o modelo selecionado.', 503);
    if (response.status === 404) throw new AiError('O modelo selecionado não está disponível para esta conta.', 503);
    if (response.status === 429 && code === 'insufficient_quota') throw new AiError('A conta do provedor está sem cota ou faturamento disponível.', 503);
    if (response.status === 429) throw new AiError('Limite do provedor atingido. Tente novamente mais tarde.', 503);
    throw new AiError('O provedor recusou a solicitação. Confira a chave, o acesso ao modelo e o faturamento.', 503);
  }
  return body;
}
export function createModel(config: AiConfig): ModelCall {
  return async (instructions, input) => {
    let text: string | undefined;
    const system = `${instructions}\nRetorne somente um objeto JSON válido, sem markdown.`;
    if (config.provider === 'openai') {
      const result = await request('https://api.openai.com/v1/responses', {
        method: 'POST', headers: { Authorization: `Bearer ${await providerCredential('openai')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.openaiModel, instructions: system, input: JSON.stringify({ responseFormat: 'json', data: input }), store: false,
          reasoning: { effort: 'minimal' }, max_output_tokens: 3000, text: { format: { type: 'json_object' } } }),
      });
      if (result.status !== 'completed') throw new AiError('O modelo não concluiu a resposta. Tente uma pergunta mais curta.', 503);
      text = result.output?.flatMap((item: { content?: { type: string; text?: string }[] }) => item.content || []).filter((item: { type: string }) => item.type === 'output_text').map((item: { text: string }) => item.text).join('');
    } else {
      const result = await request(`https://aiplatform.googleapis.com/v1/publishers/google/models/${config.vertexModel}:generateContent`, {
        method: 'POST', headers: { 'X-Goog-Api-Key': await providerCredential('vertex'), 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 3000, thinkingConfig: { thinkingLevel: 'MINIMAL' } } }),
      });
      if (result.candidates?.[0]?.finishReason !== 'STOP') throw new AiError('Não foi possível produzir uma resposta para esta pergunta.', 503);
      text = result.candidates?.[0]?.content?.parts?.filter((part: { thought?: boolean }) => !part.thought).map((part: { text?: string }) => part.text || '').join('');
    }
    try { return JSON.parse(text || ''); }
    catch { throw new AiError('O modelo retornou uma resposta inválida. Tente novamente.', 503); }
  };
}
