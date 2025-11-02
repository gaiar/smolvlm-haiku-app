import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { useWebGPU } from './hooks/useWebGPU';
import { useCamera } from './hooks/useCamera';
import { HaikuDisplay } from './components/HaikuDisplay';
import { VideoCapture } from './components/VideoCapture';
import { HaikuHistory } from './components/HaikuHistory';
import smolVLMService from './services/smolvlmService';
import qwenHaikuService from './services/qwenHaikuService';

const CAPTURE_INTERVAL = 10 * 1000; // 10 seconds in milliseconds
const MAX_HAIKU_HISTORY = 10; // Keep last 10 haikus

interface HaikuEntry {
  haiku: string;
  description: string;
  timestamp: Date;
  id: string;
}

interface ModelProgressState {
  stage: 'initializing' | 'downloading' | 'processing' | 'ready' | 'error';
  phase: 'vision' | 'language' | 'finalizing' | 'error';
  message: string;
  fileName?: string;
  percent?: number | null;
  detail?: string;
}

const extractFileName = (rawPath?: string): string | undefined => {
  if (!rawPath) {
    return undefined;
  }

  const cleanedPath = rawPath.replace(/\?.*$/, '');
  const segments = cleanedPath.split('/');
  const fileName = segments.pop() || cleanedPath;
  return fileName;
};

const computeProgressPercent = (event: any, fallback?: number | null): number | null => {
  if (!event) {
    return fallback ?? null;
  }

  if (typeof event.progress === 'number') {
    return Math.round(event.progress * 100);
  }

  if (typeof event.percentage === 'number') {
    return Math.round(event.percentage);
  }

  const loaded = event.loaded ?? event.loadedBytes;
  const total = event.total ?? event.totalBytes;

  if (typeof loaded === 'number' && typeof total === 'number' && total > 0) {
    return Math.round((loaded / total) * 100);
  }

  return fallback ?? null;
};

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
  const [modelProgress, setModelProgress] = useState<ModelProgressState>({
    stage: 'initializing',
    phase: 'vision',
    message: 'Preparing SmolVLM runtime',
    fileName: undefined,
    percent: null,
    detail: undefined,
  });
  const [currentHaiku, setCurrentHaiku] = useState<string>('');
  const [imageDescription, setImageDescription] = useState<string>('');
  const [lastCaptureTime, setLastCaptureTime] = useState<Date>(new Date());
  const [processingHaiku, setProcessingHaiku] = useState(false);
  const [timeUntilNext, setTimeUntilNext] = useState(0);
  const [haikuHistory, setHaikuHistory] = useState<HaikuEntry[]>([]);
  const [shouldAutoCapture, setShouldAutoCapture] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [capturedImage, setCapturedImage] = useState<string>('');
  const [languageModelReady, setLanguageModelReady] = useState(false);
  const [modelWarning, setModelWarning] = useState<string | null>(null);
  const processingRef = useRef(false);

  // Initialize model
  useEffect(() => {
    const initModel = async () => {
      if (!webGPU.supported) return;

      setModelWarning(null);
      setLanguageModelReady(false);

      try {
        setModelProgress({
          stage: 'initializing',
          phase: 'vision',
          message: 'Starting SmolVLM download',
          fileName: undefined,
          percent: null,
          detail: undefined,
        });

        await smolVLMService.initialize((progressEvent) => {
          setModelProgress((prev) => {
            const percent = computeProgressPercent(progressEvent, prev.percent ?? null);
            const fileName = extractFileName(progressEvent?.file) ?? prev.fileName;
            const isComplete =
              progressEvent?.status === 'done' ||
              progressEvent?.status === 'complete' ||
              percent === 100;

            if (isComplete) {
              return {
                stage: 'processing',
                phase: 'vision',
                message: 'Finalizing SmolVLM pipelines',
                fileName,
                percent: 100,
                detail: undefined,
              };
            }

            if (progressEvent?.status === 'progress' || typeof percent === 'number') {
              return {
                stage: 'downloading',
                phase: 'vision',
                message: 'Downloading SmolVLM weights',
                fileName,
                percent,
                detail: undefined,
              };
            }

            if (progressEvent?.file) {
              return {
                stage: 'downloading',
                phase: 'vision',
                message: 'Preparing SmolVLM resources',
                fileName,
                percent: percent ?? prev.percent ?? null,
                detail: undefined,
              };
            }

            return prev;
          });
        });
      } catch (error: any) {
        console.error('Failed to initialize SmolVLM:', error);
        setModelProgress({
          stage: 'error',
          phase: 'error',
          message: 'Failed to load vision model',
          fileName: undefined,
          percent: null,
          detail: error?.message ?? String(error),
        });
        setModelLoading(false);
        return;
      }

      let qwenReady = false;

      try {
        setModelProgress({
          stage: 'initializing',
          phase: 'language',
          message: 'Starting Qwen haiku generator download',
          fileName: undefined,
          percent: null,
          detail: undefined,
        });

        await qwenHaikuService.initialize((progressEvent) => {
          setModelProgress((prev) => {
            const percent = computeProgressPercent(progressEvent, prev.percent ?? null);
            const fileName = extractFileName(progressEvent?.file) ?? prev.fileName;
            const isComplete =
              progressEvent?.status === 'done' ||
              progressEvent?.status === 'complete' ||
              percent === 100;

            if (isComplete) {
              return {
                stage: 'processing',
                phase: 'language',
                message: 'Finalizing haiku generator',
                fileName,
                percent: 100,
                detail: undefined,
              };
            }

            if (progressEvent?.status === 'progress' || typeof percent === 'number') {
              return {
                stage: 'downloading',
                phase: 'language',
                message: 'Downloading haiku generator weights',
                fileName,
                percent,
                detail: undefined,
              };
            }

            if (progressEvent?.file) {
              return {
                stage: 'downloading',
                phase: 'language',
                message: 'Preparing haiku generator resources',
                fileName,
                percent: percent ?? prev.percent ?? null,
                detail: undefined,
              };
            }

            return prev;
          });
        });

        qwenReady = true;
        setLanguageModelReady(true);
      } catch (error: any) {
        console.error('Failed to initialize Qwen haiku generator:', error);
        setModelWarning('Haiku generator failed to load. Using fallback haikus from SmolVLM.');
      }

      setModelProgress({
        stage: 'ready',
        phase: qwenReady ? 'finalizing' : 'vision',
        message: qwenReady
          ? 'Models ready'
          : 'Vision model ready (haikus will use fallback)',
        fileName: undefined,
        percent: 100,
        detail: qwenReady ? undefined : 'Haiku generator unavailable; fallback haikus will be used.',
      });
      setModelLoading(false);
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

        let finalHaiku = result.haiku;

        if (languageModelReady && qwenHaikuService.isInitialized()) {
          try {
            finalHaiku = await qwenHaikuService.generateHaiku(result.description);
          } catch (haikuError: any) {
            console.error('Failed to generate haiku with Qwen:', haikuError);
            setErrorMessage(
              `Haiku generator fallback in use: ${haikuError?.message ?? 'unexpected error'}`
            );
          }
        } else {
          console.warn('Qwen haiku service not initialized; using SmolVLM fallback haiku.');
        }

        setImageDescription(result.description);
        const timestamp = new Date();

        setCurrentHaiku(finalHaiku);
        setLastCaptureTime(timestamp);

        // Add to history
        const newEntry: HaikuEntry = {
          haiku: finalHaiku,
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
  }, [captureFrame, videoRef, languageModelReady]);

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
    const percentValue =
      typeof modelProgress.percent === 'number'
        ? Math.min(100, Math.max(0, modelProgress.percent))
        : null;
    const showProgressBar = modelProgress.stage !== 'error';
    const phaseLabel =
      modelProgress.phase === 'vision'
        ? 'Vision model (SmolVLM-Instruct)'
        : modelProgress.phase === 'language'
        ? 'Haiku model (Qwen3-0.6B)'
        : modelProgress.phase === 'finalizing'
        ? 'Finalizing pipelines'
        : modelProgress.phase === 'error'
        ? 'Initialization error'
        : '';

    return (
      <div className="app loading-screen">
        <div
          className={`loading-card${modelProgress.stage === 'error' ? ' loading-error' : ''}`}
          role="status"
          aria-live="polite"
        >
          <div className="loading-spinner" aria-hidden="true" />
          <h1>Loading AI Models...</h1>
          <div className="loading-details">
            <span className="loading-stage">{modelProgress.message}</span>
            {phaseLabel && <span className="loading-phase">{phaseLabel}</span>}
            {modelProgress.fileName && (
              <span className="loading-file" title={modelProgress.fileName}>
                {modelProgress.fileName}
              </span>
            )}
            {modelProgress.detail && (
              <span className="loading-detail">{modelProgress.detail}</span>
            )}
            {showProgressBar && (
              <div className="loading-progress-wrapper">
                <div className="loading-progress-bar">
                  <div
                    className="loading-progress-fill"
                    style={{ width: `${percentValue ?? 0}%` }}
                  />
                </div>
                <span className="loading-percent">
                  {percentValue !== null ? `${percentValue}%` : '…'}
                </span>
              </div>
            )}
          </div>
          <p className="loading-note">This may take a few minutes on first load.</p>
        </div>
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
        {modelWarning && <div className="warning-banner">ℹ️ {modelWarning}</div>}
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
