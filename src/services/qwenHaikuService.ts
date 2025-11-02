import { env, pipeline } from '@huggingface/transformers';

type ProgressCallback = (progress: any) => void;

const HAIKU_PROMPT_SYSTEM =
  'You are a haiku poet. Only respond with haikus in a strict 5-7-5 syllable format. Avoid additional commentary.';

class QwenHaikuService {
  private generator: any = null;
  private loading = false;
  private initialized = false;

  async initialize(progressCallback?: ProgressCallback) {
    if (this.initialized || this.loading) {
      return;
    }

    this.loading = true;

    try {
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      this.generator = await pipeline('text-generation', 'onnx-community/Qwen3-0.6B-ONNX', {
        device: 'webgpu',
        dtype: 'q4',
        progress_callback: progressCallback,
      });

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Qwen haiku generator:', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async generateHaiku(description: string): Promise<string> {
    if (!this.generator) {
      throw new Error('Qwen haiku generator not initialized');
    }

    const trimmedDescription = description.trim() || 'a quiet unseen scene';
    const content = `Compose a haiku about: ${trimmedDescription}. Respond with only the haiku, no explanations.`;

    try {
      const messages = [
        { role: 'system', content: HAIKU_PROMPT_SYSTEM },
        { role: 'user', content },
      ];

      const output = await this.generator(messages, {
        max_new_tokens: 60,
        temperature: 0.8,
        top_p: 0.95,
        do_sample: true,
      });

      const generated = output?.[0]?.generated_text?.at(-1)?.content ?? '';
      const cleaned = this.cleanHaiku(generated);

      if (cleaned) {
        return cleaned;
      }
    } catch (error) {
      console.error('Qwen haiku generation failed:', error);
    }

    return this.createFallbackHaiku(trimmedDescription);
  }

  private cleanHaiku(text: string): string | null {
    if (!text) {
      return null;
    }

    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length >= 3) {
      return lines.slice(0, 3).join('\n');
    }

    return null;
  }

  private createFallbackHaiku(description: string): string {
    if (description.toLowerCase().includes('night')) {
      return "Moonlit silence falls\nWhispers drift through shadowed leaves\nNight hums soft and low";
    }

    if (description.toLowerCase().includes('morning')) {
      return 'Morning dew awakes\nSunlight braids the gentle breeze\nDaybreak softly sighs';
    }

    if (description.toLowerCase().includes('water')) {
      return 'Ripples hush the shore\nSilver echoes drift downstream\nWater learns to sing';
    }

    return 'Breath of present time\nPixels bloom with quiet thought\nHaiku finds its home';
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isLoading(): boolean {
    return this.loading;
  }
}

const qwenHaikuService = new QwenHaikuService();
export default qwenHaikuService;
