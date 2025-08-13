import { useEffect, useRef, useState } from 'react';

interface CameraStatus {
  stream: MediaStream | null;
  error: string | null;
  loading: boolean;
}

export const useCamera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<CameraStatus>({
    stream: null,
    error: null,
    loading: true,
  });

  // First effect: Get the camera stream
  useEffect(() => {
    let mounted = true;
    let localStream: MediaStream | null = null;

    const initCamera = async () => {
      try {
        console.log('Requesting camera access...');

        // Request camera with more flexible constraints
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { min: 320, ideal: 640, max: 1280 },
            height: { min: 240, ideal: 480, max: 720 },
            facingMode: 'user',
          },
          audio: false,
        });

        console.log('Camera stream obtained:', stream);
        console.log('Video tracks:', stream.getVideoTracks());

        if (!mounted) {
          // If component unmounted, stop the stream
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        localStream = stream;

        // Just store the stream in state, don't try to set it on video yet
        setStatus({
          stream,
          error: null,
          loading: false,
        });
          
      } catch (error) {
        console.error('Camera initialization failed:', error);
        if (mounted) {
          setStatus({
            stream: null,
            error: `Camera access failed: ${error}`,
            loading: false,
          });
        }
      }
    };

    initCamera();

    return () => {
      mounted = false;
      if (localStream) {
        console.log('Stopping camera stream...');
        localStream.getTracks().forEach((track) => {
          track.stop();
          console.log('Track stopped:', track.label);
        });
      }
    };
  }, []);

  const captureFrame = (): string | null => {
    if (!videoRef.current) {
      console.error('No video ref available');
      return null;
    }

    const video = videoRef.current;

    // Check if video is ready to capture
    if (video.readyState < video.HAVE_CURRENT_DATA) {
      console.error('Video not ready for capture, readyState:', video.readyState);
      return null;
    }

    // Check if video has valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('Video has no valid dimensions');
      return null;
    }

    try {
      const canvas = document.createElement('canvas');
      // Use smaller dimensions for better compatibility with model
      const maxWidth = 224; // MobileNet input size
      const maxHeight = 224;

      let width = video.videoWidth;
      let height = video.videoHeight;

      // Scale down if needed
      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Could not get canvas context');
        return null;
      }

      // Draw scaled image
      ctx.drawImage(video, 0, 0, width, height);

      // Try PNG format for better compatibility
      const dataUrl = canvas.toDataURL('image/png');

      // Validate the data URL
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        console.error('Invalid data URL generated');
        return null;
      }

      console.log('Frame captured successfully');
      console.log('Capture dimensions:', width, 'x', height);
      console.log('Data URL length:', dataUrl.length);

      return dataUrl;
    } catch (error) {
      console.error('Error capturing frame:', error);
      return null;
    }
  };

  return { videoRef, status, captureFrame };
};
