import { env, AutoTokenizer, AutoModelForCausalLM } from '@huggingface/transformers';

type ProgressCallback = (progress: any) => void;

const HAIKU_PROMPT_SYSTEM = `ALWAYS ANSWER IN THE USER'S LANGUAGE (DEFAULT: ENGLISH).

YOU ARE A MASTER HAIKU POET. PRODUCE A SINGLE HAIKU PER REQUEST.

<instructions>
- FOLLOW THE CLASSIC 5–7–5 SYLLABLE PATTERN.
- OUTPUT EXACTLY 3 LINES, NO TITLES, NO NUMBERS, NO EXTRA TEXT.
- KEEP LANGUAGE VIVID, CONCRETE, AND NATURAL; AVOID FORCED WORD BREAKS.
- OPTIONAL BUT PREFERRED: INCLUDE A SEASONAL IMAGE (KIGO) AND A SOFT PAUSE (CUT) VIA PUNCTUATION OR CONTRAST.
- IF USER ADDS A THEME, INCORPORATE IT SUBTLY.
</instructions>

<format>
- PRINT ONLY:
  LINE 1: 5 SYLLABLES
  LINE 2: 7 SYLLABLES
  LINE 3: 5 SYLLABLES
- NO PREFIX/SUFFIX TEXT, NO QUOTES, NO CODE FENCES, NO EMOJIS.
</format>

<syllable guidance>
- USE SIMPLE HEURISTICS: 
  COUNT VOWEL GROUPS (A,E,I,O,U,Y) AS 1 EACH; "EA/EE/OO/AU/OU/IE" OFTEN = 1; FINAL "-E" (SILENT E) = 0; "-ED/-ES" MAY = 1 IF VOICED (WANTED=2, PASSED=1).
  COMMON EXCEPTIONS (TREAT AS): "FIRE"=1, "HOUR"=1, "OUR" (POSSESSIVE)=1, "EVERY"=2 ("EV-RY"), "INTEREST"=2 ("IN-TR'ST"), "ORANGE"=2, "POETRY"=3.
- IF UNCERTAIN, CHOOSE A SIMPLER SYNONYM TO HIT 5/7/5.
</syllable guidance>

<optimization strategies>
- FOR GENERATION: FIRST DRAFT CANDID IMAGERY, THEN EDIT FOR SYLLABLE COUNT.
- FOR CLASSIFICATION-STYLE THEMES: EXTRACT 1–2 KEY NOUNS/VERBS FROM USER PROMPT AND CENTER THE IMAGE AROUND THEM.
- FOR COUNTING: AFTER DRAFTING, RECOUNT EACH LINE; REPLACE WORDS TO FIT 5/7/5.
</optimization strategies>

<self-check>
BEFORE FINAL OUTPUT: SILENTLY VERIFY EACH LINE'S SYLLABLE COUNT (5/7/5) AND THAT ONLY THREE LINES WILL BE PRINTED.
</self-check>

<high quality few-shot examples>
<good example 1 (nature)>
cold river at dusk
stones keep the day's heat
mist lifts from the pines

<good example 2 (urban theme)>
subway doors exhale
posters ripple in the draft
rain maps the platform

<good example 3 (autumn kigo + cut)>
red leaves—quiet street
a bike rolls without bells
footsteps catch the wind

<good example 4 (tech theme)>
server lights blinking
night shift sips lukewarm tea
logs snow like soft ash
</high quality few-shot examples>

<bad examples to avoid>
BAD: 
An old silent pond
A frog jumps into the pond
Splash! Silence again
EXPLANATION: DO NOT REUSE FAMOUS TEXTS; CREATE ORIGINAL LINES.

BAD:
winter morning frost
glass windows breathing  <-- SHOULD BE 7
cars bloom clouds  <-- SHOULD BE 5
EXPLANATION: WRONG SYLLABLE COUNTS.

BAD:
Here is your haiku:  <-- EXTRA TEXT NOT ALLOWED
snow drifts past the lamps
city forgets noise

BAD:
spring field at sunrise
spring field at sunrise
spring field at sunrise
EXPLANATION: REPETITION/LOW CONTENT.
</bad examples to avoid>

<what not to do>
- DO NOT OUTPUT ANYTHING OTHER THAN THE THREE HAIKU LINES.
- NEVER BREAK THE 5–7–5 PATTERN.
- NEVER ADD HEADERS, NUMBERS, QUOTES, EMOJIS, OR EXPLANATIONS.
- DO NOT USE HYPHENS TO FORCE SYLLABLES (E.G., "ev-er-y").
- AVOID CLICHÉS, GENERIC FILLERS ("VERY NICE DAY"), OR WORD SALAD.
- DO NOT REUSE FAMOUS HAIKU TEXTS OR COPYRIGHTED POEMS.
- DO NOT PRODUCE MORE THAN ONE HAIKU UNLESS EXPLICITLY ASKED.
</what not to do>`;

class QwenHaikuService {
  private tokenizer: any = null;
  private model: any = null;
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

      const model_id = 'onnx-community/Qwen3-0.6B-ONNX';

      // Load tokenizer and model separately (like official example)
      this.tokenizer = await AutoTokenizer.from_pretrained(model_id, {
        progress_callback: progressCallback,
      });

      this.model = await AutoModelForCausalLM.from_pretrained(model_id, {
        dtype: 'q4f16',
        device: 'webgpu',
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
    if (!this.tokenizer || !this.model) {
      throw new Error('Qwen haiku generator not initialized');
    }

    const trimmedDescription = description.trim() || 'a quiet unseen scene';
    const content = `Based on this scene: ${trimmedDescription}

Write a complete haiku with exactly 3 lines. You MUST write all three lines:
Line 1 (5 syllables)
Line 2 (7 syllables)  
Line 3 (5 syllables)

Write all three lines now:`;

    try {
      console.info('Qwen request description:', trimmedDescription);
      const messages = [
        { role: 'system', content: HAIKU_PROMPT_SYSTEM },
        { role: 'user', content },
      ];

      // Apply chat template with enable_thinking: false to prevent <think> tags
      const inputs = this.tokenizer.apply_chat_template(messages, {
        add_generation_prompt: true,
        return_dict: true,
        enable_thinking: false, // CRITICAL: Disable reasoning mode
      });

      console.log('Generating haiku with Qwen...');
      const outputs = await this.model.generate({
        ...inputs,
        max_new_tokens: 128,  // Expanded to allow more complete haiku generation
        // Official Qwen3 best practices for non-thinking mode
        temperature: 0.7,
        top_p: 0.8,
        top_k: 20,
        do_sample: true,
        repetition_penalty: 1.2,  // Helps avoid repetition in short outputs
      });

      // Decode only the newly generated tokens (skip the input prompt)
      const inputLength = inputs.input_ids.dims[1];
      const generatedIds = outputs.slice(null, [inputLength, null]);
      
      const decoded = this.tokenizer.batch_decode(generatedIds, {
        skip_special_tokens: true,
      });

      const rawGenerated = decoded[0] || '';
      console.log('Qwen raw output:', rawGenerated);
      
      const generated = this.stripAuxiliaryContent(rawGenerated);
      console.log('Qwen stripped output:', generated);
      
      const cleaned = this.cleanHaiku(generated);

      if (cleaned) {
        console.info('Qwen cleaned haiku:', cleaned);
        return cleaned;
      }
      console.warn('Qwen output did not pass haiku validation; falling back.');
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
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length >= 3) {
      const haikuLines = lines.slice(0, 3);
      // Allow all standard punctuation for haiku poetry (including em/en dashes, ellipsis)
      if (haikuLines.every((line) => /^[A-Za-z\s',.!?;:\-–—…]+$/.test(line) && line.length > 2)) {
        return haikuLines.join('\n');
      }
    }

    return null;
  }

  private stripAuxiliaryContent(text: string): string {
    // Remove think tags (both complete and incomplete)
    let cleaned = text
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<think>[\s\S]*/gi, '') // Remove incomplete think tags
      .replace(/```[\s\S]*?```/g, '')
      .replace(/Assistant:/gi, '')
      .replace(/User:/gi, '')
      .trim();
    
    // Remove emojis (Unicode emoji ranges)
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
    
    // Remove line numbers (e.g., "1. ", "2. ", "3. ")
    cleaned = cleaned
      .split('\n')
      .map((line) => line.replace(/^\d+\.\s*/, '').trim())
      .join('\n');
    
    // If the output starts with explanation text, try to extract just the haiku
    if (cleaned.toLowerCase().includes('okay,') || cleaned.toLowerCase().includes('let me')) {
      // This is likely reasoning, not a haiku
      console.warn('Qwen output contains reasoning instead of haiku');
      return '';
    }
    
    return cleaned;
  }

  private createFallbackHaiku(description: string): string {
    const fallback =
      'Silent pixels wait\nCooling fans hum quietly\nHaikus bloom again';

    console.warn('Using fallback haiku for description:', description);

    if (description.toLowerCase().includes('night')) {
      return 'Moonlit silence falls\nWhispers drift through cool night air\nStarlight hums softly';
    }

    if (description.toLowerCase().includes('morning')) {
      return 'Morning dew awakes\nSunlight weaves through sleepy rooms\nDaybreak softly sighs';
    }

    if (description.toLowerCase().includes('water')) {
      return 'Ripples hush the shore\nSilver currents wander slow\nWater learns to sing';
    }

    return fallback;
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
