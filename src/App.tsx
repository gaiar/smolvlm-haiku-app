import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { useWebGPU } from './hooks/useWebGPU';
import { useCamera } from './hooks/useCamera';
import { HaikuDisplay } from './components/HaikuDisplay';
import { VideoCapture } from './components/VideoCapture';
import { HaikuHistory } from './components/HaikuHistory';
import smolVLMService from './services/smolvlmService';

const CAPTURE_INTERVAL = 10 * 1000; // 10 seconds in milliseconds
const MAX_HAIKU_HISTORY = 10; // Keep last 10 haikus

interface HaikuEntry {
  haiku: string;
  description: string;
  timestamp: Date;
  id: string;
}

function App() {
  const webGPU = useWebGPU();
  const { videoRef, status: cameraStatus, captureFrame } = useCamera();
  
  // Add global error handler
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      console.error('Error message:', event.message);
      console.error('Error at:', event.filename, event.lineno, event.colno);
    };
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
    };
    
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const [modelLoading, setModelLoading] = useState(true);
  const [modelProgress, setModelProgress] = useState<string>('');
  const [currentHaiku, setCurrentHaiku] = useState<string>('');
  const [imageDescription, setImageDescription] = useState<string>('');
  const [lastCaptureTime, setLastCaptureTime] = useState<Date>(new Date());
  const [processingHaiku, setProcessingHaiku] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState(0);
  const [haikuHistory, setHaikuHistory] = useState<HaikuEntry[]>([]);
  const [shouldAutoCapture, setShouldAutoCapture] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<string>('');
  const processingRef = useRef(false);

  // Initialize model
  useEffect(() => {
    const initModel = async () => {
      if (!webGPU.supported) return;

      try {
        await smolVLMService.initialize((progress) => {
          if (progress?.status === 'progress') {
            const percent = Math.round((progress.loaded / progress.total) * 100);
            setModelProgress(`Loading ${progress.file}: ${percent}%`);
          } else if (progress?.file) {
            setModelProgress(`Loading ${progress.file}...`);
          }
        });
        setModelLoading(false);
        setModelProgress('');
      } catch (error) {
        console.error('Failed to initialize SmolVLM:', error);
        setModelProgress('Failed to load SmolVLM model');
      }
    };

    if (!webGPU.checking && webGPU.supported) {
      initModel();
    }
  }, [webGPU.checking, webGPU.supported]);

  // Generate haiku from captured frame
  const generateHaikuFromFrame = useCallback(async () => {
    if (!smolVLMService.isInitialized() || processingRef.current) return;

    console.log('Attempting to capture frame...');
    setErrorMessage(''); // Clear previous errors
    const frameData = captureFrame();

    if (!frameData) {
      const error = 'Failed to capture frame - camera may not be ready';
      console.error(error);
      setErrorMessage(error);
      // Try again in 2 seconds (give camera more time)
      setTimeout(() => {
        if (!processingRef.current && videoRef.current) {
          // Check if video is ready now
          const video = videoRef.current;
          if (video.readyState >= video.HAVE_CURRENT_DATA) {
            const retryFrameData = captureFrame();
            if (retryFrameData) {
              console.log('Retry capture successful');
              processFrame(retryFrameData);
            } else {
              setErrorMessage('Camera capture failed after retry');
            }
          } else {
            console.log('Video still not ready, readyState:', video.readyState);
            setErrorMessage('Camera is still initializing, please wait...');
          }
        }
      }, 2000);
      return;
    }

    processFrame(frameData);

    async function processFrame(data: string) {
      processingRef.current = true;
      setProcessingHaiku(true);
      setErrorMessage('');

      // Store captured image for debugging
      setCapturedImage(data);

      try {
        console.log('Processing frame data...');
        console.log('Data URL length:', data.length);
        console.log('Data URL prefix:', data.substring(0, 50));

        // Analyze the image
        const result = await smolVLMService.analyzeImageAndGenerateHaiku(data);
        console.log('SmolVLM result:', result);

        if (result.description === 'A moment captured through the lens') {
          setErrorMessage('Using fallback - SmolVLM may not be working properly');
        }

        setImageDescription(result.description);
        const timestamp = new Date();

        setCurrentHaiku(result.haiku);
        setLastCaptureTime(timestamp);

        // Add to history
        const newEntry: HaikuEntry = {
          haiku: result.haiku,
          description: result.description,
          timestamp,
          id: `haiku-${timestamp.getTime()}`,
        };

        setHaikuHistory((prev) => {
          const updated = [newEntry, ...prev];
          return updated.slice(0, MAX_HAIKU_HISTORY);
        });

        // Start the countdown for next capture
        setShouldAutoCapture(true);
        setTimeUntilNext(CAPTURE_INTERVAL / 1000);
      } catch (error: any) {
        const errorMsg = `Failed to generate haiku: ${error.message || error}`;
        console.error(errorMsg);
        setErrorMessage(errorMsg);

        const fallbackHaiku =
          'Silent pixels wait\nWebGPU dreams unfulfilled\nRefresh brings new hope';
        setCurrentHaiku(fallbackHaiku);
        // Even on error, restart the timer
        setShouldAutoCapture(true);
        setTimeUntilNext(CAPTURE_INTERVAL / 1000);
      } finally {
        processingRef.current = false;
        setProcessingHaiku(false);
      }
    }
  }, [captureFrame, videoRef]);

  // Auto-capture timer - starts AFTER haiku is displayed
  useEffect(() => {
    if (!smolVLMService.isInitialized()) return;

    // Don't start if camera is still loading or not ready
    if (cameraStatus.loading || !cameraStatus.stream) return;

    // Generate initial haiku on first load (with a delay for camera to stabilize)
    if (haikuHistory.length === 0 && !currentHaiku && !processingRef.current) {
      const initialTimer = setTimeout(() => {
        generateHaikuFromFrame();
      }, 3000); // Wait 3 seconds for camera to fully stabilize
      return () => clearTimeout(initialTimer);
    }

    // Only set timer if we should auto-capture (after haiku is displayed)
    if (!shouldAutoCapture || processingRef.current) return;

    const captureTimer = setTimeout(() => {
      setShouldAutoCapture(false);
      generateHaikuFromFrame();
    }, CAPTURE_INTERVAL);

    return () => clearTimeout(captureTimer);
  }, [
    shouldAutoCapture,
    generateHaikuFromFrame,
    cameraStatus.loading,
    cameraStatus.stream,
    haikuHistory.length,
    currentHaiku,
  ]);

  // Countdown timer - only counts down when auto-capture is scheduled
  useEffect(() => {
    if (!shouldAutoCapture || timeUntilNext <= 0) return;

    const timer = setInterval(() => {
      setTimeUntilNext((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [shouldAutoCapture, timeUntilNext]);

  // Manual capture
  const handleManualCapture = () => {
    generateHaikuFromFrame();
  };

  // Render loading states
  if (webGPU.checking) {
    return (
      <div className="app loading-screen">
        <h1>Checking WebGPU Support...</h1>
      </div>
    );
  }

  if (!webGPU.supported) {
    return (
      <div className="app error-screen">
        <h1>WebGPU Not Supported</h1>
        <p>{webGPU.error}</p>
        <p>Please use Chrome 113+ on macOS, Windows, or ChromeOS.</p>
      </div>
    );
  }

  if (cameraStatus.error) {
    return (
      <div className="app error-screen">
        <h1>Camera Access Required</h1>
        <p>{cameraStatus.error}</p>
        <p>Please allow camera access to use this application.</p>
      </div>
    );
  }

  if (modelLoading) {
    return (
      <div className="app loading-screen">
        <h1>Loading SmolVLM Model...</h1>
        <p>{modelProgress}</p>
        <p className="loading-note">This may take a few minutes on first load.</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>SmolVLM Haiku Generator</h1>
        <p className="subtitle">Real-time poetic interpretation of your world through WebGPU</p>
      </header>

      <main className="app-main">
        {errorMessage && <div className="error-banner">⚠️ {errorMessage}</div>}

        {/* Debug: Captured Image Preview */}
        {capturedImage && (
          <div
            style={{
              position: 'fixed',
              bottom: '10px',
              right: '10px',
              zIndex: 1000,
              background: 'rgba(0, 0, 0, 0.9)',
              padding: '10px',
              borderRadius: '8px',
              maxWidth: '200px',
            }}
          >
            <div style={{ color: '#0f0', fontSize: '12px', marginBottom: '5px' }}>
              Last Captured Image:
            </div>
            <img
              src={capturedImage}
              alt="Captured"
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: '4px',
              }}
              onError={(e) => {
                console.error('Failed to display captured image');
                setErrorMessage('Captured image is invalid or corrupted');
              }}
            />
          </div>
        )}

        <div className="content-grid">
          <div className="video-column">
            <VideoCapture
              videoRef={videoRef}
              onCapture={handleManualCapture}
              nextCaptureTime={timeUntilNext}
              cameraStatus={cameraStatus}
            />
          </div>

          <div className="haiku-column">
            <HaikuDisplay
              haiku={currentHaiku}
              imageDescription={imageDescription}
              timestamp={lastCaptureTime}
              loading={processingHaiku}
            />
          </div>

          <div className="history-column">
            <HaikuHistory history={haikuHistory} />
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>Powered by SmolVLM-500M running on WebGPU</p>
        <p className="tech-info">Compact vision-language model • Auto-captures every 10 seconds</p>
      </footer>
    </div>
  );
}

export default App;
