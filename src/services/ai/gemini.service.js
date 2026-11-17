/**
 * gemini.service.js
 * Google Gemini API integration for generative ticket analysis and resolution.
 */

const env = require('../../config/env');
const logger = require('../../config/logger');

class GeminiService {
  constructor() {
    this.apiKey = env.GEMINI_API_KEY;
    this.endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async generateContent(prompt) {
    if (!this.isConfigured()) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    try {
      const url = `${this.endpoint}?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            topK: 40,
            topP: 0.95
          }
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gemini API returned status ${response.status}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
      logger.error(`Gemini generation failed: ${err.message}`);
      throw err;
    }
  }
}

const geminiService = new GeminiService();

module.exports = geminiService;
