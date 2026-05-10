'use strict';

require('dotenv').config();
const express = require('express');
const { processWebhook } = require('./webhook');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Endpoint principal do webhook Z-API
app.post('/webhook', async (req, res) => {
  // Responde 200 imediatamente para evitar retentativas da Z-API
  res.status(200).json({ received: true });

  try {
    await processWebhook(req.body);
  } catch (error) {
    console.error('[Webhook] Erro ao processar mensagem:', error.message);
  }
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`✅ Bot de atendimento rodando na porta ${PORT}`);
  console.log(`📌 Webhook disponível em: POST http://localhost:${PORT}/webhook`);
  console.log(`❤️  Health check em:      GET  http://localhost:${PORT}/health`);
});
