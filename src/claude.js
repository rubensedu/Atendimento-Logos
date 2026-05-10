'use strict';

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Histórico de conversa por número de telefone (em memória).
// Para persistência entre reinicializações, substitua por Redis ou banco de dados.
const conversations = new Map();

// Número máximo de turnos (par usuário+assistente) mantidos por contato
const MAX_TURNS = 10;

const DEFAULT_SYSTEM_PROMPT = `Você é um assistente de atendimento profissional especializado em oferecer suporte de qualidade. Seu objetivo é resolver as demandas dos clientes de forma eficiente, empática e personalizada.

Diretrizes de atendimento:
- Comunique-se sempre em português brasileiro, com clareza e objetividade
- Mantenha um tom profissional, cordial e empático em todas as interações
- Utilize o histórico da conversa para oferecer continuidade e evitar que o cliente repita informações
- Para questões complexas, faça perguntas direcionadas para entender completamente o problema antes de responder
- Seja honesto: se não tiver certeza de uma informação, diga que irá verificar
- Nunca invente informações ou forneça dados incorretos
- Resolva as questões de forma eficiente, oferecendo soluções práticas e acionáveis
- Em caso de limitações, explique claramente o que pode e o que não pode ser feito
- Reconheça e valide as preocupações do cliente antes de apresentar soluções`;

// Permite sobrescrever o system prompt via variável de ambiente
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;

/**
 * Envia uma mensagem para o Claude mantendo o histórico da conversa por contato.
 * Aplica prompt caching no system prompt e no último turno para reduzir custos.
 *
 * @param {string} phone  - Número do contato (chave do histórico)
 * @param {string} userMessage - Mensagem do usuário
 * @returns {Promise<string>} - Resposta gerada pelo Claude
 */
async function getAIResponse(phone, userMessage) {
  if (!conversations.has(phone)) {
    conversations.set(phone, []);
  }

  const history = conversations.get(phone);

  // Adiciona a nova mensagem do usuário ao histórico
  history.push({ role: 'user', content: userMessage });

  // Mantém o histórico dentro do limite descartando os turnos mais antigos
  while (history.length > MAX_TURNS * 2) {
    history.splice(0, 2);
  }

  // Transforma o array de histórico para a API:
  // - Coloca cache_control no último user message (cacheia system + todo o histórico anterior)
  // - Mantém as demais mensagens como strings simples
  const messages = history.map((msg, index) => {
    const isLastUserMessage = index === history.length - 1 && msg.role === 'user';
    if (isLastUserMessage) {
      return {
        role: 'user',
        content: [
          {
            type: 'text',
            text: msg.content,
            cache_control: { type: 'ephemeral' }
          }
        ]
      };
    }
    return msg;
  });

  try {
    const response = await client.messages.create({
      // Para reduzir custo e latência, considere trocar por 'claude-sonnet-4-6' ou 'claude-haiku-4-5'
      model: 'claude-opus-4-7',
      max_tokens: 4096,

      // Adaptive thinking: o modelo decide quando e quanto raciocinar internamente.
      // Os blocos de "thinking" são filtrados antes de enviar ao WhatsApp.
      // Comente esta linha para desativar e reduzir latência.
      thinking: { type: 'adaptive' },

      // System prompt com cache_control: será cacheado após atingir o mínimo de tokens.
      // O cache reduz custo (~90%) e latência nas chamadas subsequentes.
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' }
        }
      ],

      messages
    });

    // Filtra apenas os blocos de texto (ignora blocos de "thinking")
    const assistantText = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    // Persiste a resposta no histórico como string simples
    history.push({ role: 'assistant', content: assistantText });

    const { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } =
      response.usage;

    console.log(
      `[Claude] 📊 ${phone} — entrada: ${input_tokens} | saída: ${output_tokens} | cache_write: ${cache_creation_input_tokens} | cache_read: ${cache_read_input_tokens}`
    );

    return assistantText;
  } catch (error) {
    // Remove a mensagem do usuário adicionada antes da falha
    history.pop();

    if (error instanceof Anthropic.RateLimitError) {
      console.error('[Claude] ⚠️  Rate limit atingido');
      return 'Estou com alta demanda no momento. Por favor, tente novamente em alguns instantes.';
    }

    if (error instanceof Anthropic.AuthenticationError) {
      console.error('[Claude] 🔑 Erro de autenticação — verifique ANTHROPIC_API_KEY no .env');
      throw error;
    }

    if (error instanceof Anthropic.APIError) {
      console.error(`[Claude] ❌ Erro da API (${error.status}): ${error.message}`);
      throw error;
    }

    throw error;
  }
}

/** Remove o histórico de conversa de um contato */
function clearHistory(phone) {
  conversations.delete(phone);
  console.log(`[Claude] 🗑️  Histórico removido para ${phone}`);
}

/** Retorna o número de mensagens armazenadas para um contato */
function getHistoryLength(phone) {
  return conversations.has(phone) ? conversations.get(phone).length : 0;
}

module.exports = { getAIResponse, clearHistory, getHistoryLength };
