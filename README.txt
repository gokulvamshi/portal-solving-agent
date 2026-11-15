CCBP Local Practice Helper v0.3.0

Read CCBP-Setup-Guide.pdf in the share bundle for complete installation.
Each computer needs Google Chrome, Ollama, and qwen3:4b downloaded locally.
Load this folder through chrome://extensions > Developer mode > Load unpacked.
Allow your own chrome-extension://ID origin in OLLAMA_ORIGINS and restart Ollama.
Refresh the practice tab after loading or reloading the extension.

Use Start automatic practice or Stop. There is no preview requirement and no question-count cap.
Supports text single-answer questions and native/ARIA checkbox multiple-answer questions.
It stops on errors, unexpected layouts, or when the practice screen remains absent for 5 seconds.
Start each new practice manually. It does not open another practice automatically.
Stopping cannot undo an answer already submitted. Keep the laptop awake and Ollama running.
Questions are sent to localhost:11434; answers are submitted to the current CCBP practice.
The model may answer incorrectly. Image questions are not supported.

Validation: syntax checks, local model tests, and a simulated 105-question loop.
Earlier v0.2 was verified by the user on the live portal; v0.3 changes need a live smoke test.
