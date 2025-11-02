# Project Overview
- **Name:** SmolVLM WebGPU Haiku Generator
- **Goal:** Capture live camera frames in the browser, describe each scene with SmolVLM-Instruct, and hand the description to Qwen3-0.6B to craft a 5-7-5 haiku — all locally via WebGPU.
- **Key Flow:** WebGPU capability check → camera stream acquisition → SmolVLM download & inference → description transfer to Qwen → haiku rendering + history log updates.

# Technology Stack
- **Frontend:** React 19 + TypeScript (Create React App scaffold).
- **Runtime Acceleration:** WebGPU (via `navigator.gpu`) for on-device inference.
- **ML Inference:** Transformers.js loading `HuggingFaceTB/SmolVLM-Instruct` (vision-language) and `onnx-community/Qwen3-0.6B-ONNX` (text generation).
- **UI & Styling:** CSS within CRA, glassmorphism loading card, animated haiku display.
- **Tooling:** ESLint, Prettier, Jest + Testing Library, npm scripts for build/test/lint.
- **Support Services:** `smolvlmService` (scene understanding), `qwenHaikuService` (haiku generation), plus optional Florence/Qwen fallback pipelines kept for experiments.

# Current Status
- **Implemented:** Two-model orchestration with shared progress UI, automated UI tests (SmolVLM/Qwen/camera mocks), and updated docs (`README.md`, `status.md`).
- **Resilience:** Falls back to SmolVLM-authored haikus whenever Qwen fails to load, while surfacing a warning banner.
- **Quality Checks:** `npm test -- --watchAll=false`, `npm run lint`, and `npm run build` all succeed (build continues to warn about upstream `import.meta` usage in Transformers.js).
- **Quality Checks:** `npm test -- --watchAll=false`, `npm run lint`, and `npm run build` all succeed (build continues to warn about upstream `import.meta` usage in Transformers.js).
- **Git State:** Local `main` is one commit ahead of origin (`Gracefully handle Qwen init failures`); push remains pending due to lack of GitHub connectivity.
- **Outstanding:** Track the `import.meta` warning for future transformers.js updates; push the repo to GitHub once network access/credentials are available.
