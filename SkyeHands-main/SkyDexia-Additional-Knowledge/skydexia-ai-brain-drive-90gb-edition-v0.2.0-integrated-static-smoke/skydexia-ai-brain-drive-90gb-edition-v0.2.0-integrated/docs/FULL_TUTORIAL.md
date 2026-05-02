# SkyeDexia AI Brain Drive — 90GB Edition Full Tutorial

## Package

SkyeDexia AI Brain Drive — 90GB Edition v0.1.0

This package is a compact portable AI drive foundation for Skyes Over London LC. It is designed for a roughly 90GB external drive and uses local open-weight models through Ollama.

## Core truth

The ZIP contains the SkyeDexia app, router, UI, scripts, prompts, docs, hardware checker, drive-space checker, model-pull scripts, and 90GB storage rules.

The ZIP does not include heavyweight model weights.

The external drive becomes the model vault. Your computer supplies the compute.

```txt
The ZIP = SkyeDexia app + scripts + prompts + launcher logic
The external drive = storage for model files
Your computer = CPU/GPU/RAM that runs the AI
Ollama = local AI runtime that loads and serves the models
VS Code = where you edit/control the workspace
```

## What you need installed first

You need:

```txt
Node.js 18+
npm
Ollama
VS Code
A 90GB+ external drive
```

Check Node and npm:

```bash
node -v
npm -v
```

If Node is missing on Linux/Chromebook Linux:

```bash
sudo apt update
sudo apt install -y nodejs npm
```

Install Ollama:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Check Ollama:

```bash
ollama --version
```

Start Ollama if it is not already running:

```bash
ollama serve
```

Leave that terminal open, or open a second terminal for the next steps.

## Step 1 — Unzip the package

```bash
cd ~/Downloads
unzip skydexia-ai-brain-drive-90gb-edition-v0.1.0-with-tutorial.zip
cd skydexia-ai-brain-drive-90gb-edition-v0.1.0
```

Open in VS Code:

```bash
code .
```

## Step 2 — Plug in the 90GB drive

On Chromebook Linux, removable drives are usually mounted under:

```bash
/mnt/chromeos/removable/
```

List available drives:

```bash
ls /mnt/chromeos/removable
```

Use the exact drive name.

Example path:

```bash
/mnt/chromeos/removable/SKYEDEXIA90
```

## Step 3 — Create the SkyeDexia 90GB drive layout

From inside the package folder:

```bash
bash scripts/setup-90gb-drive.sh "/mnt/chromeos/removable/YOUR_DRIVE_NAME"
```

Example:

```bash
bash scripts/setup-90gb-drive.sh "/mnt/chromeos/removable/SKYEDEXIA90"
```

This creates this structure on the drive:

```txt
SkyeDexia90GB/
  SkyeAIModels/
    ollama/
    gguf/
    huggingface/
    adapters/
    manifests/
  Workspace/
    memory/
    docs/
    exports/
    proof/
```

It also creates:

```txt
.env.skydexia
```

That file tells the terminal where the model vault lives.

## Step 4 — Activate the SkyeDexia drive environment

Run:

```bash
source .env.skydexia
```

Confirm it worked:

```bash
echo "$SKYDEXIA_DRIVE"
echo "$SKYDEXIA_MODEL_ROOT"
echo "$OLLAMA_MODELS"
```

You should see paths pointing to your external drive.

Every new terminal needs this again:

```bash
source .env.skydexia
```

Otherwise Ollama may pull models into internal storage instead of the external drive.

## Step 5 — Check drive space

Run:

```bash
bash scripts/check-drive-space.sh
```

The 90GB edition tries to keep at least 15GB free for safety.

If it says less than 15GB free, do not pull more models.

## Step 6 — Install package dependencies

Inside the package folder:

```bash
npm install
```

## Step 7 — Run the hardware checker

Run:

```bash
npm run check
```

This checks CPU, RAM, NVIDIA GPU detection through `nvidia-smi` if available, the active `OLLAMA_MODELS` path, recommended 90GB operating mode, recommended models, and warnings.

If there is no NVIDIA GPU, that is okay. It means inference may be slower.

## Step 8 — Pull the 90GB Lite models

Default 90GB-safe model pack:

```bash
bash scripts/pull-90gb-lite-models.sh
```

That script pulls:

```txt
qwen2.5-coder:7b
phi4-mini
llama3.2:3b
```

Model roles:

```txt
qwen2.5-coder:7b
Primary coding assistant. Use for code, repo work, debugging, app edits.

phi4-mini
Fast summary/extraction/synopsis helper. Use for document breakdowns and key points.

llama3.2:3b
Light general assistant. Use for basic chat and simple explanations.
```

## Step 9 — Optional Pro model

Only do this after Lite models are installed and the drive still has enough free space.

Check space again:

```bash
bash scripts/check-drive-space.sh
```

Then run:

```bash
bash scripts/pull-90gb-optional-pro-model.sh
```

That pulls:

```txt
deepseek-coder-v2:lite
```

This is the optional heavier coding/reasoning lane.

The script refuses to pull it unless there is enough space.

## Step 10 — Start the SkyeDexia app

Start the local web app:

```bash
npm run start
```

You should see:

```txt
SkyeDexia 90GB Edition running on http://localhost:8787
```

Open this in your browser:

```txt
http://localhost:8787
```

## Step 11 — Test the API manually

Health:

```bash
curl http://localhost:8787/api/health
```

Drive space:

```bash
curl http://localhost:8787/api/space
```

Hardware:

```bash
curl http://localhost:8787/api/hardware
```

Models:

```bash
curl http://localhost:8787/api/models
```

Chat:

```bash
curl -X POST http://localhost:8787/api/chat \
  -H "content-type: application/json" \
  -d '{"model":"auto","prompt":"Say SkyeDexia 90GB is running in one sentence."}'
```

## Step 12 — Run the smoke test

Start the server first:

```bash
npm run start
```

Open a second terminal in the same folder:

```bash
source .env.skydexia
npm run smoke
```

The smoke test checks:

```txt
/api/health
/api/space
/api/hardware
/api/models
/api/chat
```

It writes proof into:

```txt
proof/
```

## Step 13 — Use it inside VS Code

Open the folder in VS Code:

```bash
code .
```

Important files:

```txt
src/server.mjs
Main local server/router/API.

public/index.html
The SkyeDexia local UI.

scripts/setup-90gb-drive.sh
Creates the external drive layout.

scripts/check-drive-space.sh
Checks free space.

scripts/pull-90gb-lite-models.sh
Pulls compact local models.

scripts/pull-90gb-optional-pro-model.sh
Pulls optional DeepSeek Coder Lite if space allows.

scripts/hardware-check.mjs
Checks machine capability.

scripts/smoke-local.mjs
Runs proof smoke.

models/90gb-models.manifest.json
Defines the 90GB model strategy.

docs/NO_BULLSHIT_DIRECTIVE_90GB.md
Tracks what is real and what is not proven.
```

## Step 14 — Understand model routing

Inside `src/server.mjs`, the routing logic is:

```txt
summarize / extract / synopsis / keys
→ phi4-mini

general / chat / explain simply
→ llama3.2:3b

deep scan / hard debug / architecture audit
→ deepseek-coder-v2:lite

default
→ qwen2.5-coder:7b
```

If DeepSeek is not installed and the prompt routes to it, the request will fail honestly.

## Step 15 — Avoid filling internal storage

Before pulling models, always run:

```bash
source .env.skydexia
echo "$OLLAMA_MODELS"
```

It must point to your external drive, like:

```txt
/mnt/chromeos/removable/SKYEDEXIA90/SkyeDexia90GB/SkyeAIModels/ollama
```

If `OLLAMA_MODELS` is empty, stop.

Do not pull models until it is set.

## Step 16 — Save the workspace to the thumb drive

Recommended external drive layout:

```txt
SKYEDEXIA90/
  SkyeDexia90GB/
    App/
      skydexia-ai-brain-drive-90gb-edition-v0.1.0/
    SkyeAIModels/
      ollama/
      gguf/
      huggingface/
      adapters/
      manifests/
    Workspace/
      memory/
      docs/
      exports/
      proof/
```

Copy the app folder to the drive:

```bash
mkdir -p "$SKYDEXIA_DRIVE/SkyeDexia90GB/App"
cp -R . "$SKYDEXIA_DRIVE/SkyeDexia90GB/App/skydexia-ai-brain-drive-90gb-edition-v0.1.0"
```

Later, open directly:

```bash
cd "$SKYDEXIA_DRIVE/SkyeDexia90GB/App/skydexia-ai-brain-drive-90gb-edition-v0.1.0"
source .env.skydexia
npm install
npm run start
```

## Step 17 — Memory folder usage

Starter memory vault:

```txt
memory/starter-vault/
```

Drive workspace memory folder:

```txt
$SKYDEXIA_WORKSPACE_ROOT/memory
```

Use it for business notes, project instructions, repo summaries, client workflows, SkyeDexia rules, model behavior notes, sales scripts, and document examples.

Current limitation: the app does not yet have full RAG indexing. It will not automatically search every file in the memory vault yet.

## Step 18 — Current truth of the build

Completed:

```txt
✅ 90GB edition repo structure exists
✅ Local UI exists
✅ Node router exists
✅ /api/health exists
✅ /api/models exists
✅ /api/hardware exists
✅ /api/space exists
✅ /api/chat exists
✅ 90GB external drive setup script exists
✅ Drive space checker exists
✅ Lite model pull script exists
✅ Optional Pro model pull script exists
✅ Hardware checker exists
✅ Local smoke script exists
✅ 90GB model manifest exists
✅ Product copy exists
✅ Edition guide exists
```

Open:

```txt
☐ Browser automation proof
☐ Full installer wizard
☐ Windows launcher
☐ macOS launcher
☐ ChromeOS one-click launcher
☐ llama.cpp GGUF runner
☐ Local RAG indexer
☐ File upload document parser
☐ Fine-tuned SkyeDexia adapter
☐ Signed customer package
☐ License key system
☐ GPU deployment smoke
☐ Physical 90GB drive proof
```

Do not market this yet as a finished consumer plug-and-play AI drive. It is a real foundation, not the final sellable installer edition.

## Common problems and fixes

If Ollama is not reachable:

```bash
ollama serve
```

Then in another terminal:

```bash
npm run start
```

If models pull to the wrong place:

```bash
echo "$OLLAMA_MODELS"
```

If it is empty:

```bash
source .env.skydexia
```

If your drive path has spaces, quote it:

```bash
bash scripts/setup-90gb-drive.sh "/mnt/chromeos/removable/USB Drive"
```

If `/api/chat` fails, check installed models:

```bash
ollama list
```

If `qwen2.5-coder:7b` is missing:

```bash
ollama pull qwen2.5-coder:7b
```

If the drive gets too full:

```bash
bash scripts/check-drive-space.sh
```

Remove unnecessary models:

```bash
ollama list
ollama rm MODEL_NAME
```

Example:

```bash
ollama rm deepseek-coder-v2:lite
```

## Exact full clean setup sequence

```bash
cd ~/Downloads
unzip skydexia-ai-brain-drive-90gb-edition-v0.1.0-with-tutorial.zip
cd skydexia-ai-brain-drive-90gb-edition-v0.1.0

npm install

ls /mnt/chromeos/removable

bash scripts/setup-90gb-drive.sh "/mnt/chromeos/removable/YOUR_DRIVE_NAME"
source .env.skydexia

npm run check
bash scripts/check-drive-space.sh
bash scripts/pull-90gb-lite-models.sh

npm run start
```

Open:

```txt
http://localhost:8787
```

In another terminal:

```bash
cd ~/Downloads/skydexia-ai-brain-drive-90gb-edition-v0.1.0
source .env.skydexia
npm run smoke
```

## Next phase

The next useful phase should close real gaps:

```txt
✅ Add file upload parser
✅ Add local document synopsis route
✅ Add local RAG indexing over memory folder
✅ Add ChromeOS launcher script
✅ Add browser-click smoke using Playwright
✅ Add package export script for copying app + env to the drive
```
