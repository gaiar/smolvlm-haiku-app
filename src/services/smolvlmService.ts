import { AutoModelForVision2Seq, AutoProcessor, RawImage } from '@huggingface/transformers';

export const SMOLVLM_FALLBACK_DESCRIPTION = 'A moment captured in stillness';

class SmolVLMService {
  private model: any = null;
  private processor: any = null;
  private loading: boolean = false;
  private initialized: boolean = false;

  async initialize(progressCallback?: (progress: any) => void) {
    if (this.initialized || this.loading) return;

    this.loading = true;

    try {
      // Use SmolVLM-256M-Instruct (smaller, faster model)
      const modelId = 'HuggingFaceTB/SmolVLM-256M-Instruct';

      console.log('Loading SmolVLM 256M processor...');
      this.processor = await AutoProcessor.from_pretrained(modelId, {
        progress_callback: progressCallback,
      });

      console.log('Loading SmolVLM 256M model...');
      this.model = await AutoModelForVision2Seq.from_pretrained(modelId, {
        dtype: 'fp32',
        device: 'webgpu',
        progress_callback: progressCallback,
      });

      this.initialized = true;
      console.log('SmolVLM initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SmolVLM:', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async analyzeImage(imageDataUrl: string): Promise<{ description: string }> {
    if (!this.model || !this.processor) {
      throw new Error('SmolVLM not initialized');
    }

    try {
      // Load image from data URL
      console.log('Loading image for SmolVLM...');
      const image = await RawImage.fromURL(imageDataUrl);

      // Create messages - keep it simple for SmolVLM-256M to provide rich, poetic descriptions
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'image' },
            {
              type: 'text',
              text: 'Describe this scene in vivid, sensory detail. Focus on the main subject, their action or appearance, the setting, lighting, and atmosphere. Be observational and poetic.',
            },
          ],
        },
      ];

      // Apply chat template
      const prompt = this.processor.apply_chat_template(messages, {
        add_generation_prompt: true,
      });

      // Process inputs - note: pass image in array like Python version
      const inputs = await this.processor(prompt, [image], { return_tensors: 'pt' });

      // Generate response with parameters similar to Python version
      console.log('SmolVLM generate(): dispatching request');
      const outputs = await this.model.generate({
        ...inputs,
        max_new_tokens: 200,  // Increased for structured 7-line output
        min_new_tokens: 50,
        no_repeat_ngram_size: 2,
        do_sample: true,
        temperature: 0.7,  // Slightly lower for more structured output
        top_p: 0.9,
      });

      // Decode the response
      const generatedText = this.processor.batch_decode(outputs, {
        skip_special_tokens: true,
        skip_prompt: true,
      })[0];

      console.log('SmolVLM raw response:', generatedText);

      // Clean up the response - remove any chat formatting
      let cleanResponse = generatedText;

      // Remove "Assistant:" prefix if present
      if (cleanResponse.includes('Assistant:')) {
        cleanResponse = cleanResponse.split('Assistant:').pop()?.trim() || cleanResponse;
      }

      // Remove any "User:" sections
      if (cleanResponse.includes('User:')) {
        cleanResponse = cleanResponse.split('User:')[0].trim();
      }

      console.log('SmolVLM cleaned response:', cleanResponse);

      const description = this.extractDescription(cleanResponse);

      if (description) {
        console.info('SmolVLM parsed description:', description);
        return { description };
      }

      console.warn('SmolVLM description parsing failed; using fallback description.');
      return { description: this.createFallbackDescription() };
    } catch (error) {
      console.error('SmolVLM analysis failed:', error);
      console.warn('SmolVLM falling back to default description due to error.');

      // Fallback response
      return {
        description: this.createFallbackDescription(),
      };
    }
  }

  private extractDescription(text: string): string | null {
    // Extract natural description from SmolVLM output
    const lines = text
      .split(/\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 10); // Skip very short lines

    if (lines.length > 0) {
      // Take all meaningful lines for rich context
      const candidate = lines.join(' ');
      return this.sanitizeDescription(candidate);
    }

    return null;
  }

  private sanitizeDescription(rawDescription: string): string | null {
    const normalized = rawDescription.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return null;
    }

    const lower = normalized.toLowerCase();
    const disallowed = ['bitch', 'fuck', 'shit', 'damn', 'bastard'];
    if (disallowed.some((word) => lower.includes(word))) {
      console.warn('SmolVLM description contained disallowed language and was discarded.');
      return null;
    }

    // No limitations - pass the full description to Qwen for richer haiku context
    return normalized;
  }

  private createFallbackDescription(): string {
    return SMOLVLM_FALLBACK_DESCRIPTION;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isLoading(): boolean {
    return this.loading;
  }
}

const smolVLMService = new SmolVLMService();
export default smolVLMService;
