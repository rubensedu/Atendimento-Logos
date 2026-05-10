'use strict';

const { getAIResponse } = require('./claude');
const { sendTextMessage } = require('./zapi');

async function processWebhook(data) {
  // Loga status de entrega para diagnóstico
  if (data.type === 'DeliveryCallback') {
    if (data.error) {
      console.error(`[Delivery] ❌ Falha na entrega para ${data.phone}: ${data.error}`);
    } else {
      console.log(`[Delivery] ✅ Entregue para ${data.phone} — zaapId: ${data.zaapId || 'N/A'}`);
    }
    return;
  }

  // Log temporário para diagnóstico
  console.log('[Webhook] RAW:', JSON.stringify(data).slice(0, 300));

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
    const paragraphs = await getAIResponse(phone, userMessage);
    for (const paragraph of paragraphs) {
      await sendTextMessage(phone, paragraph);
    }
    console.log(`[Webhook] ✅ Resposta enviada em ${paragraphs.length} mensagem(ns) para ${senderName} (${phone})`);
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
