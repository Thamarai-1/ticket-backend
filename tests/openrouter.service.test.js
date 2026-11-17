/**
 * openrouter.service.test.js
 * Unit tests for OpenRouter service integration and AI provider routing.
 */

const openRouterService = require('../src/services/ai/openrouter.service');
const aiProviderService = require('../src/services/ai/ai-provider.service');

describe('OpenRouter AI Integration', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('openRouterService', () => {
    it('should report not configured when apiKey is empty', () => {
      openRouterService.apiKey = '';
      expect(openRouterService.isConfigured()).toBe(false);
    });

    it('should throw an error when attempting completion without API key', async () => {
      openRouterService.apiKey = '';
      await expect(
        openRouterService.generateChatCompletion([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('OPENROUTER_API_KEY is not configured');
    });

    it('should successfully complete chat prompt when API key is present', async () => {
      openRouterService.apiKey = 'sk-or-test-key-12345';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'gen-123',
          model: 'openai/gpt-4o-mini',
          choices: [
            {
              message: {
                role: 'assistant',
                content: '{"title":"Restart Service","steps":["Step 1: Check status","Step 2: Restart"]}'
              }
            }
          ],
          usage: { total_tokens: 42 }
        })
      });

      const result = await openRouterService.completePrompt('Resolve network incident');
      expect(result).toContain('Restart Service');
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toContain('/chat/completions');
      expect(options.headers.Authorization).toBe('Bearer sk-or-test-key-12345');
      expect(options.headers['X-Title']).toBe('IT-Ticket-Assistant');
    });

    it('should handle API errors gracefully', async () => {
      openRouterService.apiKey = 'sk-or-test-key-12345';

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: { message: 'Rate limit exceeded' }
        })
      });

      await expect(
        openRouterService.completePrompt('Analyze ticket')
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('aiProviderService with OpenRouter', () => {
    it('should select OpenRouter when openrouter service is configured', () => {
      openRouterService.apiKey = 'sk-or-valid-key';
      expect(aiProviderService.getAvailableProvider()).toBe('openrouter');
    });

    it('should execute completePrompt through OpenRouter when provider is active', async () => {
      openRouterService.apiKey = 'sk-or-valid-key';
      jest.spyOn(openRouterService, 'completePrompt').mockResolvedValue('OpenRouter generated response');

      const res = await aiProviderService.completePrompt('How to fix LDAP sync?');
      expect(res).toBe('OpenRouter generated response');
    });
  });
});
