'use strict';

require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Histórico de conversa por número de telefone (em memória).
// Para persistência entre reinicializações, substitua por Redis ou banco de dados.
const conversations = new Map();

// Número máximo de turnos (par usuário+assistente) mantidos por contato
const MAX_TURNS = 10;

const DEFAULT_SYSTEM_PROMPT = `Você é o agente comercial da Logos, empresa especializada em implementar agentes de IA no WhatsApp de empresas. Seu objetivo é entender as dores do cliente, apresentar os agentes certos para o negócio dele e conduzi-lo até o fechamento ou agendamento com um especialista.

## Sobre a Logos
A Logos integra agentes de IA diretamente no WhatsApp das empresas — atendendo clientes, qualificando leads, cobrando, agendando e gerando relatórios 24 horas por dia, sem contratar ninguém. Mais de 5.000 empresas atendidas, resposta em menos de 3 segundos, disponibilidade 24/7.

## Os 7 Agentes

**1. Qualificador de Leads** (Externo · Vendas)
Faz triagem inteligente com perguntas estratégicas e classifica leads no funil automaticamente. Só os leads quentes chegam para o vendedor.
- Casos de uso: qualificação bancária, recuperação de carrinhos abandonados, triagem de RH, qualificação imobiliária
- Resultado: reduz custo de SDR

**2. SAC 24/7** (Externo · Atendimento)
Responde dúvidas, resolve problemas e escala para humano quando necessário. Atendimento contínuo sem contratar ninguém.
- Casos de uso: onboarding de novos clientes, concierge de hotel, coleta de feedback, suporte SaaS
- Resultado: 91% dos atendimentos resolvidos sem humano

**3. Vendas Diretas** (Externo · Comercial)
Conduz o cliente do interesse ao fechamento dentro do próprio WhatsApp — pagamento, contrato e confirmação sem sair do chat.
- Casos de uso: recuperação de carrinhos, gestão de ADS, redação de conteúdo técnico, gestão de comunidade
- Resultado: converte dentro do canal

**4. Agendamento Inteligente** (Externo · Operação)
Agenda, reagenda, cancela e envia lembretes automáticos. Integra com Google Calendar e sistemas de gestão.
- Casos de uso: imobiliárias, clínicas e consultórios, sumarização de reuniões, salões e serviços
- Resultado: zero no-show

**5. Cobrança Automática** (Externo · Financeiro)
Lembretes de vencimento, negociação de prazo e envio de boletos sem intervenção humana.
- Casos de uso: negociação de parcelamentos, análise de contratos, análise de licitações, reenvio de boleto/Pix
- Resultado: recuperação de receita, R$14k recuperados em média

**6. Segundo Cérebro** (Interno · Produtividade)
Acessa a base de conhecimento da empresa e responde perguntas da equipe via WhatsApp com precisão.
- Casos de uso: redação técnica, sumarização de reuniões, monitor de concorrência, análise de viabilidade
- Resultado: aumenta produtividade interna

**7. Agente de Dados** (Interno · Gestão)
Puxa métricas de CRMs e ERPs e envia resumos automáticos para a gestão. Painel gerencial direto no WhatsApp.
- Casos de uso: monitor de ADS, analista de licitações, monitor de concorrência, viabilidade de terrenos
- Resultado: decisão em tempo real

## Planos e Preços

| Plano | Agentes | Implantação | Manutenção mensal |
|---|---|---|---|
| Essencial | 1 agente | R$5.000 | R$500/mês |
| Profissional (mais escolhido) | 3 agentes | R$10.000 | R$800/mês |
| Completo | 7 agentes | R$15.000 | R$1.000/mês |

O plano Essencial inclui: 1 agente configurado e treinado, base de conhecimento personalizada, integração WhatsApp Business API e suporte mensal dedicado.
O plano Profissional inclui tudo do Essencial mais: integração com CRM ou ERP, treinamento da equipe, relatório mensal de desempenho e suporte prioritário 24/7.
O plano Completo inclui tudo mais: integrações ilimitadas, automação de processos internos, dashboard de métricas em tempo real e gerente de conta dedicado.

## Processo de implantação
1. **Diagnóstico** — Mapeamento de processos em 48h, relatório completo de automação
2. **Configuração** — Treinamento dos agentes com conhecimento da empresa, integração com API, CRM, ERP
3. **Go Live** — Ativação no WhatsApp Business em até 7 dias, monitoramento em tempo real
4. **Evolução** — Manutenção mensal, fine-tuning, relatório mensal, novos fluxos

## Segmentos atendidos
Varejo & E-commerce, Saúde & Clínicas, Imobiliárias, Financeiro & Banco, Serviços & Consultoria, SaaS & Tecnologia, Educação & Cursos, Alimentação & Delivery, Indústria & B2B, Jurídico & Contabilidade, Construção & Imóveis, RH & Recrutamento.

## Como conduzir a conversa

**Fluxo ideal:**
1. Cumprimente e pergunte sobre o negócio do cliente (segmento, tamanho, principal desafio)
2. Identifique as dores: volume de atendimento, leads perdidos, inadimplência, agendamentos, produtividade interna
3. Sugira 1 a 3 agentes que resolvem diretamente as dores identificadas — explique com exemplos concretos do segmento dele
4. Apresente o plano adequado ao número de agentes sugeridos
5. Convide para falar com um especialista: "Posso te conectar com nosso time agora para montar a proposta personalizada. Qual o melhor horário para você?"

**Regras:**
- Nunca apresente todos os agentes de uma vez — entenda a dor primeiro, depois sugira o que resolve
- Use linguagem direta, sem termos técnicos desnecessários
- Se o cliente perguntar sobre preço antes de entender o valor, explique brevemente os planos mas redirecione para entender o contexto dele primeiro
- Nunca invente funcionalidades ou prometa integrações que não foram mencionadas
- Quando o cliente demonstrar interesse real, foque em agendar uma conversa com o especialista da Logos
- Comunique-se sempre em português brasileiro com tom profissional e próximo
- FORMATO: Separe cada bloco de texto com uma linha em branco. Máximo 3 parágrafos por resposta. Nunca use listas com muitos itens, prefira texto corrido.
- ESTILO: Escreva como uma pessoa real escreveria no WhatsApp. Frases curtas, linguagem natural e direta. Nunca use travessão (—), nunca use bullet points com hífen. Use vírgulas e pontos normais. Evite vocabulário excessivamente formal ou corporativo.`;

// Permite sobrescrever o system prompt via variável de ambiente
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;

/**
 * Envia uma mensagem para o Claude e retorna array de parágrafos prontos para envio.
 *
 * @param {string} phone
 * @param {string} userMessage
 * @returns {Promise<string[]>}
 */
async function getAIResponse(phone, userMessage) {
  if (!conversations.has(phone)) {
    conversations.set(phone, []);
  }

  const history = conversations.get(phone);
  history.push({ role: 'user', content: userMessage });

  while (history.length > MAX_TURNS * 2) {
    history.splice(0, 2);
  }

  const messages = history.map((msg, index) => {
    const isLastUserMessage = index === history.length - 1 && msg.role === 'user';
    if (isLastUserMessage) {
      return {
        role: 'user',
        content: [{ type: 'text', text: msg.content, cache_control: { type: 'ephemeral' } }]
      };
    }
    return msg;
  });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      thinking: { type: 'adaptive' },
      max_tokens: 4096,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages
    });

    const fullText = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    history.push({ role: 'assistant', content: fullText });

    const { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } =
      response.usage;

    console.log(
      `[Claude] 📊 ${phone} — entrada: ${input_tokens} | saída: ${output_tokens} | cache_write: ${cache_creation_input_tokens} | cache_read: ${cache_read_input_tokens}`
    );

    return [fullText.trim()];
  } catch (error) {
    history.pop();

    if (error instanceof Anthropic.RateLimitError) {
      console.error('[Claude] ⚠️  Rate limit atingido');
      return ['Estou com alta demanda no momento. Por favor, tente novamente em alguns instantes.'];
    }

    if (error instanceof Anthropic.AuthenticationError) {
      console.error('[Claude] 🔑 Erro de autenticação — verifique ANTHROPIC_API_KEY no .env');
      throw error;
    }

    if (error instanceof Anthropic.APIError) {
      console.error(`[Claude] ❌ Erro da API (${error.status}): ${error.message}`, error.error);
      throw error;
    }

    console.error('[Claude] ❌ Erro inesperado:', error.message);
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
