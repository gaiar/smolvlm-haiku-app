import { pipeline, env } from '@huggingface/transformers';

// Configure environment for browser usage
env.allowLocalModels = false;
env.useBrowserCache = true;

class ModelService {
  private imageCaptionPipeline: any = null;
  private textGenerationPipeline: any = null;
  private loading: boolean = false;
  private initialized: boolean = false;

  async initialize(progressCallback?: (progress: any) => void) {
    if (this.initialized || this.loading) return;

    this.loading = true;

    try {
      // Initialize image-to-text pipeline
      // Using Florence-2 or a CLIP-based model for image captioning
      this.imageCaptionPipeline = await pipeline(
        'image-to-text',
        'onnx-community/Florence-2-base-ft',
        {
          device: 'webgpu',
          dtype: {
            embed_tokens: 'fp16',
            vision_encoder: 'fp16',
            encoder_model: 'q4',
            decoder_model_merged: 'q4',
          },
          progress_callback: progressCallback,
        }
      );

      // Initialize text generation for haiku refinement
      this.textGenerationPipeline = await pipeline(
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
    if (!this.imageCaptionPipeline) {
      throw new Error('Model not initialized');
    }

    try {
      // Convert data URL to blob
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();

      // Generate image caption
      const result = await this.imageCaptionPipeline(blob, {
        max_new_tokens: 100,
      });

      return result[0].generated_text || 'A moment captured in time';
    } catch (error) {
      console.error('Image analysis failed:', error);
      return 'A moment captured in time';
    }
  }

  async generateHaiku(imageDescription: string): Promise<string> {
    if (!this.textGenerationPipeline) {
      throw new Error('Text generation model not initialized');
    }

    const prompt = `You are a haiku poet. Create a beautiful haiku based on this scene: "${imageDescription}"

A haiku must have exactly 3 lines:
- First line: 5 syllables
- Second line: 7 syllables  
- Third line: 5 syllables

The haiku should capture the essence and emotion of the scene in a contemplative, nature-inspired way.

Haiku:`;

    try {
      const result = await this.textGenerationPipeline(prompt, {
        max_new_tokens: 50,
        temperature: 0.8,
        do_sample: true,
        top_p: 0.9,
      });

      // Extract just the haiku from the response
      const generatedText = result[0].generated_text;
      const haikuMatch = generatedText.match(/Haiku:\s*([\s\S]*?)(?:\n\n|$)/);

      if (haikuMatch && haikuMatch[1]) {
        return haikuMatch[1].trim();
      }

      // Fallback to a simple haiku if generation fails
      return this.createFallbackHaiku(imageDescription);
    } catch (error) {
      console.error('Haiku generation failed:', error);
      return this.createFallbackHaiku(imageDescription);
    }
  }

  private createFallbackHaiku(description: string): string {
    // Simple fallback haiku based on time of day
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

const modelService = new ModelService();
export default modelService;
