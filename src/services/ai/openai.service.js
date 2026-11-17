/**
 * openai.service.js
 * OpenAI API integration for completions and embeddings.
 */

const env = require('../../config/env');
const logger = require('../../config/logger');

class OpenAIService {
  constructor() {
    this.apiKey = env.OPENAI_API_KEY;
    this.endpoint = 'https://api.openai.com/v1/chat/completions';
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generateChatCompletion(messages, model = 'gpt-4o-mini') {
    if (!this.isConfigured()) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `OpenAI API returned status ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      logger.error(`OpenAI completion failed: ${err.message}`);
      throw err;
    }
  }
}

const openAIService = new OpenAIService();

module.exports = openAIService;
