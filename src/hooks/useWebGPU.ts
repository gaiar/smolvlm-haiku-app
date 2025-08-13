import { useEffect, useState } from 'react';

interface WebGPUStatus {
  supported: boolean;
  checking: boolean;
  error: string | null;
}

export const useWebGPU = (): WebGPUStatus => {
  const [status, setStatus] = useState<WebGPUStatus>({
    supported: false,
    checking: true,
    error: null,
  });

  useEffect(() => {
    const checkWebGPU = async () => {
      try {
        if (!navigator.gpu) {
          setStatus({
            supported: false,
            checking: false,
            error:
              'WebGPU is not supported in this browser. Please use Chrome 113+ on macOS, Windows, or ChromeOS.',
          });
          return;
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          setStatus({
            supported: false,
            checking: false,
            error: 'No appropriate GPUAdapter found.',
          });
          return;
        }

        setStatus({
          supported: true,
          checking: false,
          error: null,
        });
      } catch (error) {
        setStatus({
          supported: false,
          checking: false,
          error: `WebGPU check failed: ${error}`,
        });
      }
    };

    checkWebGPU();
  }, []);

  return status;
};
