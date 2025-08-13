# SmolVLM WebGPU Haiku Generator

A React application that uses WebGPU to run AI models directly in your browser for real-time video analysis and haiku generation. The app captures video from your camera, analyzes the scene using computer vision models, and generates poetic haikus based on what it sees.

## Features

- 🎥 Real-time camera video capture
- 🤖 AI-powered image analysis using MobileNetV4 running on WebGPU
- ✍️ Automatic haiku generation using Qwen2.5 language model
- ⏱️ Auto-refresh every 10 seconds
- 🎯 Manual capture button for on-demand haiku creation
- 📜 History list showing previous haikus (up to 10)
- 🎨 Beautiful, responsive UI with gradient animations
- 🚀 Runs entirely in the browser - no server required!

## Requirements

- **Browser**: Chrome 113+ (WebGPU support required)
- **Platform**: Optimized for MacBook Pro M3, but works on any WebGPU-capable device
- **Camera**: Device with camera access

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd smolvlm-haiku-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open Chrome and navigate to `http://localhost:3000`

5. Allow camera permissions when prompted

## How It Works

1. **WebGPU Detection**: The app first checks if your browser supports WebGPU
2. **Camera Access**: Requests permission to access your camera
3. **Model Loading**: Downloads and initializes AI models (first load may take a few minutes)
4. **Image Capture**: Captures frames from the video stream
5. **Scene Analysis**: Uses MobileNetV4 to understand what's in the image
6. **Haiku Generation**: Creates a poetic haiku based on the scene using Qwen2.5
7. **Auto-Refresh**: Automatically generates new haikus every 10 seconds

## Models Used

- **Image Classification**: `onnx-community/mobilenetv4_conv_small.e2400_r224_in1k`
- **Text Generation**: `onnx-community/Qwen2.5-0.5B-Instruct`

Both models are optimized for WebGPU and run entirely in your browser using [Transformers.js](https://github.com/huggingface/transformers.js).

## Available Scripts

### `npm start`
Runs the app in development mode. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

### `npm run build`
Builds the app for production to the `build` folder.

### `npm test`
Launches the test runner in interactive watch mode.

## Project Structure

```
src/
├── components/
│   ├── HaikuDisplay.tsx      # Displays generated haikus
│   ├── VideoCapture.tsx      # Camera video feed component
├── hooks/
│   ├── useWebGPU.ts          # WebGPU detection hook
│   ├── useCamera.ts          # Camera access hook
├── services/
│   ├── simpleModelService.ts # AI model management
├── App.tsx                   # Main application component
└── App.css                   # Application styles
```

## Troubleshooting

### WebGPU Not Supported
- Ensure you're using Chrome 113 or later
- Check chrome://gpu to verify WebGPU is enabled
- Try enabling the flag at chrome://flags/#enable-unsafe-webgpu

### Camera Not Working
- Check browser permissions for camera access
- Ensure no other application is using the camera
- Try refreshing the page

### Models Not Loading
- Check your internet connection (models are downloaded on first use)
- Clear browser cache and try again
- Check the browser console for specific error messages

## Performance Notes

- First load will download models (~100-200MB), which are then cached
- Subsequent loads will be much faster
- WebGPU acceleration provides smooth, real-time performance
- Optimized for Apple Silicon (M1/M2/M3) but works on other GPUs

## Privacy

All processing happens locally in your browser. No data is sent to any server. Your camera feed and generated content remain completely private.

## License

MIT

## Acknowledgments

- Built with [Transformers.js](https://github.com/huggingface/transformers.js)
- Models from [Hugging Face](https://huggingface.co/)
- WebGPU API by W3C
- Created with Create React App
