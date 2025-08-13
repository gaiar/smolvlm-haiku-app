import { AutoModelForVision2Seq, AutoProcessor, RawImage } from '@huggingface/transformers';

class SmolVLMService {
  private model: any = null;
  private processor: any = null;
  private loading: boolean = false;
  private initialized: boolean = false;

  async initialize(progressCallback?: (progress: any) => void) {
    if (this.initialized || this.loading) return;

    this.loading = true;

    try {
      // Use SmolVLM-Instruct for better capability
      const modelId = 'HuggingFaceTB/SmolVLM-Instruct';

      console.log('Loading SmolVLM processor...');
      this.processor = await AutoProcessor.from_pretrained(modelId, {
        progress_callback: progressCallback,
      });

      console.log('Loading SmolVLM model...');
      this.model = await AutoModelForVision2Seq.from_pretrained(modelId, {
        dtype: {
          embed_tokens: 'fp16',
          vision_encoder: 'fp16',
          encoder_model: 'q4',
          decoder_model_merged: 'q4',
        },
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

  async analyzeImageAndGenerateHaiku(
    imageDataUrl: string
  ): Promise<{ description: string; haiku: string }> {
    if (!this.model || !this.processor) {
      throw new Error('SmolVLM not initialized');
    }

    try {
      // Load image from data URL
      console.log('Loading image for SmolVLM...');
      const image = await RawImage.fromURL(imageDataUrl);

      // Create messages with proper format for SmolVLM (matching Python example)
      const messages = [
        {
          role: 'user',
          content: [
            { type: 'image' },
            {
              type: 'text',
              text: 'Describe this image and then write a short haiku poem about it.',
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
      console.log('Generating response from SmolVLM...');
      const outputs = await this.model.generate({
        ...inputs,
        max_new_tokens: 100,
        min_new_tokens: 10,
        no_repeat_ngram_size: 2,
        do_sample: true,
        temperature: 0.8,
        top_p: 0.95,
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

      console.log('Cleaned response:', cleanResponse);

      // Look for haiku pattern (3 lines) or create from description
      const lines = cleanResponse.split('\n').filter((line: string) => line.trim().length > 0);

      let description = '';
      let haiku = '';

      // Check if response contains both description and haiku
      const haikuKeywords = ['haiku', 'poem', 'verse'];
      const hasHaikuKeyword = haikuKeywords.some((keyword) =>
        cleanResponse.toLowerCase().includes(keyword)
      );

      if (hasHaikuKeyword) {
        // Try to split description and haiku
        const parts = cleanResponse.split(/haiku:?|poem:?|verse:?/i);
        if (parts.length > 1) {
          description = parts[0].trim();
          haiku = parts[1].trim().split('\n').slice(0, 3).join('\n');
        } else {
          // Use last 3 lines as haiku, rest as description
          if (lines.length > 3) {
            description = lines.slice(0, -3).join(' ');
            haiku = lines.slice(-3).join('\n');
          } else {
            haiku = lines.join('\n');
            description = 'A moment captured in time';
          }
        }
      } else if (lines.length === 3) {
        // If exactly 3 lines, assume it's a haiku
        haiku = lines.join('\n');
        description = 'A poetic moment';
      } else {
        // Use response as description and generate haiku
        description = cleanResponse.substring(0, 200);
        haiku = this.createHaikuFromDescription(description);
      }

      return { description, haiku };
    } catch (error) {
      console.error('SmolVLM analysis failed:', error);

      // Fallback response
      return {
        description: 'A moment captured through the lens',
        haiku: this.createFallbackHaiku(),
      };
    }
  }

  private createHaikuFromDescription(description: string): string {
    // Extract key words from description
    const words = description.toLowerCase().split(/\s+/);

    // Look for key elements in the description
    const hasMan = words.includes('man') || words.includes('person');
    const hasWall = words.includes('wall') || words.includes('background');

    // Generate contextual haiku based on description
    if (hasMan && hasWall) {
      return 'Man sits quietly\nBehind walls, life continues\nMoment captured here';
    } else if (hasMan) {
      return 'Person in the frame\nStillness speaks without words\nTime pauses to watch';
    } else if (description.includes('green')) {
      return 'Green spaces unfold\nNature meets technology\nBalance in pixels';
    } else if (description.includes('focus')) {
      return 'Focused attention\nIn this digital moment\nPresence captured now';
    }

    // Default to time-based haiku
    return this.createFallbackHaiku();
  }

  private createFallbackHaiku(): string {
    const hour = new Date().getHours();

    if (hour < 6 || hour > 20) {
      return "Night's quiet moment\nCamera captures stillness\nPeace in pixels found";
    } else if (hour < 12) {
      return 'Morning light appears\nThrough the lens, life awakening\nNew day beginning';
    } else if (hour < 17) {
      return 'Afternoon unfolds\nMoments frozen in the frame\nTime stands still for us';
    } else {
      return "Evening shadows fall\nCapturing the day's last light\nMemories preserved";
    }
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
