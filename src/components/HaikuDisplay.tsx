import React, { useState } from 'react';
import './HaikuDisplay.css';
import { ttsService } from '../services/ttsService';

interface HaikuDisplayProps {
  haiku: string;
  imageDescription: string;
  timestamp: Date;
  loading: boolean;
}

export const HaikuDisplay: React.FC<HaikuDisplayProps> = ({
  haiku,
  imageDescription,
  timestamp,
  loading,
}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleReadAloud = async () => {
    if (!ttsService.isInitialized()) {
      alert('Text-to-speech is not supported in your browser');
      return;
    }

    if (isSpeaking) {
      ttsService.stop();
      setIsSpeaking(false);
      return;
    }

    const haikuLines = haiku.split('\n').filter((line) => line.trim());
    if (haikuLines.length === 0) return;

    setIsSpeaking(true);
    try {
      await ttsService.readHaiku(haikuLines);
    } catch (error) {
      console.error('TTS error:', error);
      alert('Failed to read haiku aloud. Please try again.');
    } finally {
      setIsSpeaking(false);
    }
  };

  if (loading) {
    return (
      <div className="haiku-container loading">
        <div className="spinner"></div>
        <p>Composing haiku...</p>
      </div>
    );
  }

  const haikuLines = haiku.split('\n').filter((line) => line.trim());

  return (
    <div className="haiku-container">
      <div className="haiku-card">
        <div className="haiku-header">
          <button
            className={`read-aloud-button ${isSpeaking ? 'speaking' : ''}`}
            onClick={handleReadAloud}
            title={isSpeaking ? 'Stop reading' : 'Read haiku aloud'}
            aria-label={isSpeaking ? 'Stop reading' : 'Read haiku aloud'}
          >
            {isSpeaking ? '⏸' : '🔊'}
          </button>
        </div>

        <div className="haiku-text">
          {haikuLines.map((line, index) => (
            <div key={index} className="haiku-line">
              {line}
            </div>
          ))}
        </div>

        {imageDescription && (
          <div className="image-description">
            <span className="description-label">Scene: </span>
            {imageDescription}
          </div>
        )}

        <div className="timestamp">Generated at {formatTime(timestamp)}</div>
      </div>
    </div>
  );
};
