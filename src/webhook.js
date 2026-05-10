'use strict';

const { getAIResponse } = require('./claude');
const { sendTextMessage } = require('./zapi');

async function processWebhook(data) {
  // Ignora callbacks que não são de mensagens recebidas
  if (data.type !== 'ReceivedCallback') return;

  // Ignora mensagens enviadas pelo próprio número
  if (data.fromMe === true) return;

  // Ignora mensagens sem conteúdo de texto
  if (!data.text || !data.text.message) {
    console.log(`[Webhook] Tipo de mídia não suportado recebido de ${data.phone} — ignorado`);
    return;
  }

  // Ignora mensagens de grupos (remova este bloco para suportar grupos)
  if (data.isGroup === true) {
    console.log(`[Webhook] Mensagem de grupo ignorada`);
    return;
  }

  const phone = data.phone;
  const userMessage = data.text.message.trim();
  const senderName = data.senderName || data.chatName || 'Cliente';

  if (!userMessage) return;

  console.log(`[Webhook] 📨 ${senderName} (${phone}): ${userMessage}`);

  try {
    let count = 0;
    await getAIResponse(phone, userMessage, async (paragraph) => {
      await sendTextMessage(phone, paragraph);
      count++;
    });
    console.log(`[Webhook] ✅ Resposta enviada em ${count} mensagem(ns) para ${senderName} (${phone})`);
  } catch (error) {
    console.error(`[Webhook] ❌ Erro ao atender ${phone}:`, error.message);

    // Tenta enviar mensagem de erro genérica ao cliente
    try {
      await sendTextMessage(
        phone,
        'Desculpe, ocorreu um erro temporário. Por favor, tente novamente em alguns instantes.'
      );
    } catch {
      // Silencia erro de fallback para não mascarar o erro original
    }
  }
}

module.exports = { processWebhook };
