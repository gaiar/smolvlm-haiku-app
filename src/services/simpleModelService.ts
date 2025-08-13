import { pipeline, env } from '@huggingface/transformers';

// Configure environment for browser usage
env.allowLocalModels = false;
env.useBrowserCache = true;

class SimpleModelService {
  private imageClassifier: any = null;
  private textGenerator: any = null;
  private loading: boolean = false;
  private initialized: boolean = false;

  async initialize(progressCallback?: (progress: any) => void) {
    if (this.initialized || this.loading) return;

    this.loading = true;

    try {
      // Use image classification as a simpler alternative
      this.imageClassifier = await pipeline(
        'image-classification',
        'onnx-community/mobilenetv4_conv_small.e2400_r224_in1k',
        {
          device: 'webgpu',
          progress_callback: progressCallback,
        }
      );

      // Use a small text generation model for haiku creation
      this.textGenerator = await pipeline(
        'text-generation',
        'onnx-community/Qwen2.5-0.5B-Instruct',
        {
          device: 'webgpu',
          dtype: 'q4',
          progress_callback: progressCallback,
        }
      );

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize models:', error);
      throw error;
    } finally {
      this.loading = false;
    }
  }

  async analyzeImage(imageDataUrl: string): Promise<string> {
    if (!this.imageClassifier) {
      throw new Error('Model not initialized');
    }

    try {
      // Validate the data URL
      if (!imageDataUrl || !imageDataUrl.startsWith('data:image')) {
        console.error('Invalid image data URL');
        return 'A moment captured in time';
      }

      console.log('Analyzing image...');
      console.log('Data URL format:', imageDataUrl.substring(0, 30));

      // First test with a simple image element
      const img = new Image();
      img.crossOrigin = 'anonymous';

      const loadPromise = new Promise((resolve, reject) => {
        img.onload = () => {
          console.log('Image loaded successfully:', img.width, 'x', img.height);
          resolve(true);
        };
        img.onerror = (e) => {
          console.error('Image failed to load:', e);
          reject(e);
        };
      });

      img.src = imageDataUrl;

      try {
        await loadPromise;
      } catch (imgError) {
        console.error('Could not load image for validation:', imgError);
        return 'Camera image could not be loaded';
      }

      // Try to classify the image
      console.log('Attempting classification...');

      try {
        const results = await this.imageClassifier(imageDataUrl, {
          topk: 3, // Get top 3 classifications
        });

        console.log('Classification results:', results);

        // Create a description from the classifications
        if (results && results.length > 0) {
          const topResult = results[0];
          const label = topResult.label.replace(/_/g, ' ').toLowerCase();
          const confidence = (topResult.score * 100).toFixed(1);
          console.log(`Top classification: ${label} (${confidence}% confidence)`);

          // Add some variety to descriptions
          const descriptors = [
            `A ${label} in view`,
            `${label} captured`,
            `Seeing a ${label}`,
            `${label} in frame`,
          ];
          return descriptors[Math.floor(Math.random() * descriptors.length)];
        }
      } catch (classifyError) {
        console.error('Classification failed:', classifyError);
        // Fallback to time-based description
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 12) return 'Morning scene captured';
        if (hour >= 12 && hour < 17) return 'Afternoon moment frozen';
        if (hour >= 17 && hour < 20) return 'Evening view recorded';
        return 'Night scene observed';
      }

      return 'A moment captured in time';
    } catch (error) {
      console.error('Image analysis failed:', error);
      return 'A moment captured in time';
    }
  }

  async generateHaiku(imageDescription: string): Promise<string> {
    if (!this.textGenerator) {
      throw new Error('Text generation model not initialized');
    }

    // Add randomness to the prompt
    const randomSeed = Math.random();
    const style = randomSeed > 0.5 ? 'contemplative' : 'observational';

    const messages = [
      {
        role: 'system',
        content:
          'You are a haiku poet. Create haikus with exactly 3 lines: first line 5 syllables, second line 7 syllables, third line 5 syllables. Be concise and poetic.',
      },
      {
        role: 'user',
        content: `Write a ${style} haiku about: ${imageDescription}. Focus on the moment. Only respond with the haiku, nothing else.`,
      },
    ];

    try {
      console.log('Generating haiku for:', imageDescription);

      const result = await this.textGenerator(messages, {
        max_new_tokens: 40,
        temperature: 0.9,
        do_sample: true,
        top_p: 0.95,
      });

      const generatedText = result[0].generated_text.at(-1).content;
      console.log('Generated text:', generatedText);

      // Clean up the haiku
      const lines = generatedText
        .split('\n')
        .filter((line: string) => line.trim().length > 0)
        .slice(0, 3);

      if (lines.length === 3) {
        return lines.join('\n');
      }

      // Fallback to a simple haiku if generation fails
      return this.createFallbackHaiku(imageDescription);
    } catch (error) {
      console.error('Haiku generation failed:', error);
      return this.createFallbackHaiku(imageDescription);
    }
  }

  private createFallbackHaiku(description: string): string {
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

const simpleModelService = new SimpleModelService();
export default simpleModelService;
