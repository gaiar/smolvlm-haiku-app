// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

const mockSmolVLMService = {
  initialize: jest.fn().mockImplementation(async () => {
    mockSmolVLMService.isInitialized.mockReturnValue(true);
  }),
  isInitialized: jest.fn().mockReturnValue(false),
  analyzeImageAndGenerateHaiku: jest.fn().mockResolvedValue({
    description: 'Mock description',
    haiku: 'Mock line one\nMock line two\nMock line three',
  }),
  isLoading: jest.fn().mockReturnValue(false),
};

jest.mock('./services/smolvlmService', () => ({
  __esModule: true,
  default: mockSmolVLMService,
}));

const mockQwenHaikuService = {
  initialize: jest.fn().mockImplementation(async () => {
    mockQwenHaikuService.isInitialized.mockReturnValue(true);
  }),
  isInitialized: jest.fn().mockReturnValue(false),
  isLoading: jest.fn().mockReturnValue(false),
  generateHaiku: jest.fn().mockResolvedValue('Mock Qwen line one\nMock line two\nMock line three'),
};

jest.mock('./services/qwenHaikuService', () => ({
  __esModule: true,
  default: mockQwenHaikuService,
}));

if (!global.navigator.mediaDevices) {
  Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
      getUserMedia: jest
        .fn()
        .mockRejectedValue(new Error('Camera not available in test environment')),
    },
    configurable: true,
    writable: true,
  });
} else {
  jest
    .spyOn(global.navigator.mediaDevices, 'getUserMedia')
    .mockRejectedValue(new Error('Camera not available in test environment'));
}
