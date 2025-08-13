#!/bin/bash

echo "🚀 Starting SmolVLM WebGPU Haiku Generator..."
echo ""
echo "📋 Requirements:"
echo "  - Chrome 113+ (for WebGPU support)"
echo "  - Camera access permission"
echo "  - MacBook Pro M3 (or any WebGPU-capable device)"
echo ""
echo "🔗 The app will open at: http://localhost:3001"
echo ""
echo "⏳ Note: First load will download AI models (~100-200MB)"
echo "   This may take a few minutes, but models are cached for future use."
echo ""

# Check if port 3000 is in use and use 3001 instead
PORT=3001 npm start