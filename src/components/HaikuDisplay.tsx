import React from 'react';
import './HaikuDisplay.css';

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
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
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
