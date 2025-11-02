import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import { useWebGPU } from './hooks/useWebGPU';
import { useCamera } from './hooks/useCamera';
import smolVLMService from './services/smolvlmService';
import qwenHaikuService from './services/qwenHaikuService';

jest.mock('./hooks/useWebGPU', () => ({
  useWebGPU: jest.fn(),
}));

jest.mock('./hooks/useCamera', () => ({
  useCamera: jest.fn(),
}));

const mockUseWebGPU = useWebGPU as jest.MockedFunction<typeof useWebGPU>;
const mockUseCamera = useCamera as jest.MockedFunction<typeof useCamera>;
const mockSmolVLMService = smolVLMService as jest.Mocked<typeof smolVLMService>;
const mockQwenHaikuService = qwenHaikuService as jest.Mocked<typeof qwenHaikuService>;

describe('App', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSmolVLMService.isInitialized.mockReturnValue(false);
    mockQwenHaikuService.isInitialized.mockReturnValue(true);
  });

  test('renders WebGPU unsupported screen when API is unavailable', async () => {
    mockUseWebGPU.mockReturnValue({
      supported: false,
      checking: false,
      error: 'WebGPU is not supported in this environment.',
    });

    mockUseCamera.mockReturnValue({
      videoRef: { current: null },
      status: { stream: null, error: null, loading: false },
      captureFrame: jest.fn(),
    });

    render(<App />);

    expect(await screen.findByText(/WebGPU Not Supported/i)).toBeInTheDocument();
    expect(screen.getByText(/Please use Chrome 113\+/i)).toBeInTheDocument();
  });

  test('renders main interface when WebGPU and camera are ready', async () => {
    mockUseWebGPU.mockReturnValue({
      supported: true,
      checking: false,
      error: null,
    });

    const mockStream = {
      getVideoTracks: jest.fn().mockReturnValue([]),
    } as unknown as MediaStream;

    mockUseCamera.mockReturnValue({
      videoRef: { current: document.createElement('video') },
      status: { stream: mockStream, error: null, loading: false },
      captureFrame: jest.fn().mockReturnValue('data:image/png;base64,mock'),
    });

    mockSmolVLMService.isInitialized.mockReturnValue(true);

    render(<App />);

    expect(await screen.findByRole('heading', { name: /SmolVLM Haiku Generator/i })).toBeInTheDocument();
    expect(screen.getByText(/Auto-captures every 10 seconds/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Capture Now/i })).toBeInTheDocument();
  });
});
