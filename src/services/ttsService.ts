/**
 * Text-to-Speech Service using Web Speech API
 * Provides instant, high-quality TTS using OS-level voices (Siri on macOS, etc.)
 * Zero download, zero configuration required.
 */

class TTSService {
  private synthesis: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synthesis = window.speechSynthesis;
      console.log('Web Speech API TTS initialized (instant, zero download)');
    }
  }

  isInitialized(): boolean {
    return this.synthesis !== null;
  }

  isLoading(): boolean {
    return false; // Web Speech API is instant
  }

  /**
   * Read haiku text aloud using Web Speech API
   * @param haikuLines Array of haiku lines
   */
  async readHaiku(haikuLines: string[]): Promise<void> {
    if (!this.synthesis) {
      throw new Error('Web Speech API not supported in this browser');
    }

    // Stop any ongoing speech
    this.stop();

    // Join haiku lines with natural pauses
    const haikuText = haikuLines.join('... '); // Ellipsis creates natural pause

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(haikuText);
      this.currentUtterance = utterance;

      // Optimize for haiku reading (slower, more deliberate)
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Try to select a high-quality English voice
      const voices = this.synthesis!.getVoices();
      if (voices.length > 0) {
        const englishVoice =
          voices.find((v) => v.lang.startsWith('en-') && v.name.includes('Enhanced')) ||
          voices.find((v) => v.lang.startsWith('en-') && v.name.includes('Premium')) ||
          voices.find((v) => v.lang.startsWith('en-') && !v.name.includes('Google'));

        if (englishVoice) {
          utterance.voice = englishVoice;
        }
      }

      utterance.onend = () => {
        this.currentUtterance = null;
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        this.currentUtterance = null;
        reject(event);
      };

      // Speak the haiku
      this.synthesis!.speak(utterance);
    });
  }

  /**
   * Stop any ongoing speech
   */
  stop(): void {
    if (this.synthesis && this.synthesis.speaking) {
      this.synthesis.cancel();
    }
    this.currentUtterance = null;
  }

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synthesis?.speaking ?? false;
  }
}

// Export singleton instance
export const ttsService = new TTSService();

