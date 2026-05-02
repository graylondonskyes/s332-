# SkyeDexia 90GB Integrated Tutorial v0.2.0

This package combines:

- SkyeDexia AI Brain Drive — 90GB Edition
- Full tutorial docs
- Docker launch pack
- CPU/basic Docker mode
- GPU Docker mode
- External model vault setup
- Lite model pull scripts
- Optional Pro model pull guard

## What changed in v0.2.0

The Docker pack has been merged directly into the SkyeDexia 90GB repo. You no longer need to manually copy Docker files into the project.

## Fast path: normal local mode

```bash
cd skydexia-ai-brain-drive-90gb-edition-v0.2.0-integrated
npm install

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

## Fast path: Docker mode

Create the Docker env file:

```bash
cp .env.docker.example .env.docker
```

Edit `.env.docker` and set your model path:

```bash
SKYDEXIA_MODEL_ROOT=/mnt/chromeos/removable/YOUR_DRIVE_NAME/SkyeDexia90GB/SkyeAIModels
```

Start Docker:

```bash
bash run-docker.sh
```

Open:

```txt
http://localhost:8787
```

Pull models into the Docker Ollama container:

```bash
docker exec -it skydexia90-ollama ollama pull qwen2.5-coder:7b
docker exec -it skydexia90-ollama ollama pull phi4-mini
docker exec -it skydexia90-ollama ollama pull llama3.2:3b
```

Optional Pro model, only if enough space remains:

```bash
docker exec -it skydexia90-ollama ollama pull deepseek-coder-v2:lite
```

## GPU Docker mode

Only use this if the host supports Docker NVIDIA GPU runtime.

```bash
bash run-docker-gpu.sh
```

## Stop Docker

```bash
bash stop-docker.sh
```

## Product truth

The drive stores the SkyeDexia package and model files.

The host computer supplies compute:

- CPU
- GPU, if available
- RAM
- VRAM
- storage speed

Docker makes launch and deployment cleaner. Docker does not make weak hardware fast.

## Recommended 90GB model set

Default:

```bash
qwen2.5-coder:7b
phi4-mini
llama3.2:3b
```

Optional:

```bash
deepseek-coder-v2:lite
```

Do not default 32B/70B/frontier full weights on a 90GB drive.

## Verify

Local app:

```bash
curl http://localhost:8787/api/health
curl http://localhost:8787/api/space
curl http://localhost:8787/api/hardware
curl http://localhost:8787/api/models
```

Smoke:

```bash
npm run smoke
```

## Current honest status

✅ Integrated package exists
✅ Docker pack merged
✅ App container Dockerfile exists
✅ Ollama container compose file exists
✅ GPU compose file exists
✅ Docker run/stop scripts exist
✅ External model vault setup exists
✅ 90GB storage guard exists
✅ Lite model pull lane exists
✅ Optional Pro model guard exists
☐ Physical drive proof not run here
☐ Actual model pull not run here
☐ Docker runtime proof not run here
☐ GPU proof not run here
☐ Fine-tuned SkyeDexia adapter not included yet
