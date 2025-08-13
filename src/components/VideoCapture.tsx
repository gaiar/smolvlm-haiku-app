import React, { useEffect, useState, useRef } from 'react';
import './VideoCapture.css';

interface VideoCaptureProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onCapture: () => void;
  nextCaptureTime: number;
  cameraStatus?: {
    stream: MediaStream | null;
    error: string | null;
    loading: boolean;
  };
}

interface VideoDebugInfo {
  width: number;
  height: number;
  readyState: number;
  videoWidth: number;
  videoHeight: number;
  srcObject: boolean;
  tracks: number;
}

export const VideoCapture: React.FC<VideoCaptureProps> = ({
  videoRef,
  onCapture,
  nextCaptureTime,
  cameraStatus,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [debugInfo, setDebugInfo] = useState<VideoDebugInfo>({
    width: 0,
    height: 0,
    readyState: 0,
    videoWidth: 0,
    videoHeight: 0,
    srcObject: false,
    tracks: 0,
  });

  // Connect stream to video element
  useEffect(() => {
    const video = localVideoRef.current;
    const stream = cameraStatus?.stream;
    
    if (!video || !stream) {
      console.log('VideoCapture: Waiting for video element and stream...', 
        'video:', !!video, 
        'stream:', !!stream);
      return;
    }

    console.log('VideoCapture: Connecting stream to video element');
    
    // Set explicit dimensions
    video.width = 640;
    video.height = 480;
    
    // Add error handler
    video.onerror = (e) => {
      console.error('VideoCapture: Video element error:', e);
      const videoError = video.error;
      if (videoError) {
        console.error('Video error code:', videoError.code);
        console.error('Video error message:', videoError.message);
      }
    };
    
    // Set the stream
    video.srcObject = stream;
    console.log('VideoCapture: srcObject set');
    
    // Wait for metadata to load before playing
    video.onloadedmetadata = () => {
      console.log('VideoCapture: Video metadata loaded');
      console.log('Video dimensions:', video.videoWidth, 'x', video.videoHeight);
      
      video.play()
        .then(() => {
          console.log('VideoCapture: Video playing successfully');
          // Update the external ref if provided
          if (videoRef && videoRef.current !== video) {
            (videoRef as any).current = video;
          }
        })
        .catch((err: Error) => {
          console.error('VideoCapture: Error playing video:', err);
        });
    };
    
    // Cleanup
    return () => {
      if (video.srcObject) {
        video.srcObject = null;
      }
    };
  }, [cameraStatus?.stream, videoRef]);

  useEffect(() => {
    const updateDebugInfo = () => {
      const video = localVideoRef.current;
      if (video) {
        const stream = video.srcObject as MediaStream;
        setDebugInfo({
          width: video.width,
          height: video.height,
          readyState: video.readyState,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          srcObject: !!video.srcObject,
          tracks: stream ? stream.getVideoTracks().length : 0,
        });
      }
    };

    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 500);
    return () => clearInterval(interval);
  }, [cameraStatus]);

  const formatTimeRemaining = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getReadyStateText = (state: number): string => {
    switch (state) {
      case 0:
        return 'HAVE_NOTHING';
      case 1:
        return 'HAVE_METADATA';
      case 2:
        return 'HAVE_CURRENT_DATA';
      case 3:
        return 'HAVE_FUTURE_DATA';
      case 4:
        return 'HAVE_ENOUGH_DATA';
      default:
        return 'UNKNOWN';
    }
  };

  return (
    <div className="video-capture-container">
      <div className="video-wrapper">
        <video 
          ref={localVideoRef} 
          autoPlay 
          playsInline 
          muted 
          className="camera-feed"
          width={640}
          height={480}
        />
        <div className="video-overlay">
          <div className="capture-indicator">
            <span className="recording-dot"></span>
            Live Feed
          </div>
          {/* Debug Info Overlay */}
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              background: 'rgba(0, 0, 0, 0.8)',
              color: '#0f0',
              padding: '5px',
              fontSize: '10px',
              fontFamily: 'monospace',
              borderRadius: '3px',
            }}
          >
            <div>
              Video: {debugInfo.videoWidth}x{debugInfo.videoHeight}
            </div>
            <div>
              Element: {debugInfo.width}x{debugInfo.height}
            </div>
            <div>Ready: {getReadyStateText(debugInfo.readyState)}</div>
            <div>Stream: {debugInfo.srcObject ? 'Yes' : 'No'}</div>
            <div>Tracks: {debugInfo.tracks}</div>
          </div>
        </div>
      </div>

      <div className="controls">
        <button className="capture-button" onClick={onCapture}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="7" fill="currentColor" />
          </svg>
          Capture Now
        </button>

        <div className="timer-info">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path d="M12 6V12L16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Next auto-capture in {formatTimeRemaining(nextCaptureTime)}
        </div>
      </div>
    </div>
  );
};
