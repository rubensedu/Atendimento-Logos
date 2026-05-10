'use strict';

require('dotenv').config();
const axios = require('axios');

const ZAPI_BASE_URL = `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}`;

const zapiClient = axios.create({
  baseURL: ZAPI_BASE_URL,
  headers: {
    'Client-Token': process.env.ZAPI_CLIENT_TOKEN,
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

/**
 * Envia uma mensagem de texto via Z-API.
 *
 * @param {string} phone   - Número no formato internacional sem '+' (ex: 5511999999999)
 * @param {string} message - Texto a ser enviado
 * @returns {Promise<object>} - Resposta da Z-API
 */
async function sendTextMessage(phone, message) {
  try {
    const { data } = await zapiClient.post('/send-text', { phone, message });
    console.log(`[Z-API] ✉️  Mensagem enviada para ${phone} — zaapId: ${data.zaapId || 'N/A'}`);
    return data;
  } catch (error) {
    if (error.response) {
      console.error(
        `[Z-API] ❌ Erro ${error.response.status} ao enviar para ${phone}:`,
        JSON.stringify(error.response.data)
      );
    } else {
      console.error(`[Z-API] ❌ Falha de conexão ao enviar para ${phone}:`, error.message);
    }
    throw error;
  }
}

module.exports = { sendTextMessage };
