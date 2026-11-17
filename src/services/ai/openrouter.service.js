/**
 * openrouter.service.js
 * OpenRouter AI API integration for Multi-Model LLM routing and grounded generation.
 * Supports OpenAI, Anthropic Claude, Meta Llama, Google Gemini, and DeepSeek via OpenRouter.
 */

const env = require('../../config/env');
const logger = require('../../config/logger');

class OpenRouterService {
  constructor() {
    this.apiKey = env.OPENROUTER_API_KEY;
    this.defaultModel = env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    this.baseUrl = (env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
    this.endpoint = `${this.baseUrl}/chat/completions`;
    this.appTitle = 'IT-Ticket-Assistant';
    this.siteUrl = 'https://api.thama.dpdns.org';
  }

  /**
   * Check if OpenRouter is configured with an active API key.
   */
  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Generates a chat completion using the specified OpenRouter model.
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} options
   */
  async generateChatCompletion(messages, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const model = options.model || this.defaultModel;
    const temperature = options.temperature !== undefined ? options.temperature : 0.2;
    const max_tokens = options.max_tokens || 2048;

    const payload = {
      model,
      messages,
      temperature,
      max_tokens
    };

    if (options.response_format) {
      payload.response_format = options.response_format;
    }

    try {
      const controller = new AbortController();
      const timeoutMs = options.timeoutMs || 15000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': this.siteUrl,
          'X-Title': this.appTitle
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData.error?.message || `OpenRouter returned HTTP ${response.status}`;
        throw new Error(errMsg);
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const content = choice?.message?.content || '';

      logger.info(`[OpenRouter] Completed prompt using model ${data.model || model}. Tokens: ${data.usage?.total_tokens || 'N/A'}`);
      return content;
    } catch (err) {
      logger.error(`[OpenRouter] Request failed (${model}): ${err.message}`);
      throw err;
    }
  }

  /**
   * Helper to execute a single prompt string.
   */
  async completePrompt(prompt, options = {}) {
    const messages = [{ role: 'user', content: prompt }];
    return this.generateChatCompletion(messages, options);
  }
}

const openRouterService = new OpenRouterService();

module.exports = openRouterService;
