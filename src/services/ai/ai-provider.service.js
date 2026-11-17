/**
 * ai-provider.service.js
 * Unified AI Provider abstraction factory supporting OpenRouter, Gemini, OpenAI, and ML-Service.
 */

const env = require('../../config/env');
const openRouterService = require('./openrouter.service');
const geminiService = require('./gemini.service');
const openAIService = require('./openai.service');
const logger = require('../../config/logger');

class AIProviderService {
  getAvailableProvider() {
    const configuredPreference = (env.AI_PROVIDER || '').toLowerCase();

    if (configuredPreference === 'openrouter' && openRouterService.isConfigured()) {
      return 'openrouter';
    }
    if (configuredPreference === 'gemini' && geminiService.isConfigured()) {
      return 'gemini';
    }
    if (configuredPreference === 'openai' && openAIService.isConfigured()) {
      return 'openai';
    }

    // Auto-detection priority: OpenRouter -> Gemini -> OpenAI -> Local/ML-Service
    if (openRouterService.isConfigured()) return 'openrouter';
    if (geminiService.isConfigured()) return 'gemini';
    if (openAIService.isConfigured()) return 'openai';
    return 'ml-service';
  }

  async completePrompt(prompt, options = {}) {
    const provider = this.getAvailableProvider();

    if (provider === 'openrouter') {
      return openRouterService.completePrompt(prompt, options);
    }

    if (provider === 'gemini') {
      return geminiService.generateContent(prompt);
    }

    if (provider === 'openai') {
      return openAIService.generateChatCompletion([{ role: 'user', content: prompt }]);
    }

    logger.debug('No external LLM provider configured; using default ML pipeline service.');
    return null;
  }
}

const aiProviderService = new AIProviderService();

module.exports = aiProviderService;
