# Project Overview
- **Name:** SmolVLM WebGPU Haiku Generator
- **Goal:** Capture live camera frames in the browser, run SmolVLM-Instruct locally via WebGPU, and turn the resulting scene understanding into haiku poetry.
- **Key Flow:** WebGPU capability check → camera stream acquisition → SmolVLM model download/initialisation → continuous frame capture → description + haiku generation → history log and UI updates.

# Technology Stack
- **Frontend:** React 19 + TypeScript (Create React App scaffold).
- **Runtime Acceleration:** WebGPU (via `navigator.gpu`) for on-device inference.
- **ML Inference:** `@huggingface/transformers` (Transformers.js) loading `HuggingFaceTB/SmolVLM-Instruct`.
- **UI & Styling:** CSS modules within CRA; custom glassmorphism loading card; animated haiku presentation.
- **Tooling:** ESLint, Prettier, Jest + Testing Library, npm scripts for build/test/lint.
- **Support Services:** `smolvlmService` for model orchestration, optional Florence/Qwen fallback services kept for experiments.

# Current Status
- **Implemented:** Stable loader progress card, automated UI tests mocking SmolVLM and camera APIs, documented setup/runtime instructions, and progress log (`status.md`).
- **Quality Checks:** `npm test -- --watchAll=false`, `npm run lint`, and `npm run build` complete (build issues a known upstream `import.meta` warning from Transformers.js).
- **Outstanding:** Investigate/mitigate the import.meta warning when feasible; publish the repo to GitHub once credentials and network access are available.
