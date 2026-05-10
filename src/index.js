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

  // Pinga o próprio servidor a cada 4 minutos para evitar cold start no Railway
  const selfUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/health`
    : null;

  if (selfUrl) {
    const http = require('https');
    setInterval(() => {
      http.get(selfUrl, (res) => {
        console.log(`[Keep-alive] ping → ${res.statusCode}`);
      }).on('error', (e) => {
        console.warn(`[Keep-alive] falha: ${e.message}`);
      });
    }, 4 * 60 * 1000);
    console.log(`🔄 Keep-alive ativo → ${selfUrl}`);
  }
});
