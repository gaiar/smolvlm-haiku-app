import React from 'react';
import './HaikuHistory.css';

interface HaikuEntry {
  haiku: string;
  description: string;
  timestamp: Date;
  id: string;
}

interface HaikuHistoryProps {
  history: HaikuEntry[];
}

export const HaikuHistory: React.FC<HaikuHistoryProps> = ({ history }) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (history.length === 0) {
    return (
      <div className="haiku-history">
        <h3 className="history-title">Previous Haikus</h3>
        <div className="history-empty">
          <p>No previous haikus yet</p>
          <p className="history-hint">Haikus will appear here as they are generated</p>
        </div>
      </div>
    );
  }

  return (
    <div className="haiku-history">
      <h3 className="history-title">Previous Haikus</h3>
      <div className="history-list">
        {history.map((entry, index) => {
          const haikuLines = entry.haiku.split('\n').filter((line) => line.trim());

          return (
            <div key={entry.id} className={`history-item ${index === 0 ? 'latest' : ''}`}>
              <div className="history-haiku">
                {haikuLines.map((line, lineIndex) => (
                  <div key={lineIndex} className="history-haiku-line">
                    {line}
                  </div>
                ))}
              </div>
              <div className="history-meta">
                <span className="history-description">{entry.description}</span>
                <span className="history-time">{formatTime(entry.timestamp)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
