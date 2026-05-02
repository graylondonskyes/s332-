# SkyeDexia 90GB Docker Pack v0.1.0

This is the Docker launcher pack for SkyeDexia AI Brain Drive — 90GB Edition.

It runs two containers:

1. `skydexia90-app` — the SkyeDexia web UI and router API.
2. `skydexia90-ollama` — the local Ollama model runtime.

The model files stay outside the containers on your external drive or server volume.

## Core truth

Docker packages the app and runtime.  
The model vault stores the weights.  
The host machine still provides CPU/GPU/RAM.

## Expected folder placement

Drop this Docker pack into the root of your SkyeDexia 90GB repo, so your folder looks like:

```txt
skydexia-ai-brain-drive-90gb-edition-v0.1.0/
  public/
  src/
  scripts/
  package.json
  Dockerfile
  docker-compose.yml
  docker-compose.gpu.yml
  .env.docker.example
  run-docker.sh
  stop-docker.sh
```

## Quick start

From the SkyeDexia repo root:

```bash
cp .env.docker.example .env.docker
nano .env.docker
```

Set your external model path.

Example Chromebook/Linux path:

```bash
SKYDEXIA_MODEL_ROOT=/mnt/chromeos/removable/SKYEDEXIA90/SkyeDexia90GB/SkyeAIModels
```

Then run CPU/basic Docker:

```bash
bash run-docker.sh
```

Open:

```txt
http://localhost:8787
```

## Pull models into the Docker Ollama container

After Docker is running:

```bash
docker exec -it skydexia90-ollama ollama pull qwen2.5-coder:7b
docker exec -it skydexia90-ollama ollama pull phi4-mini
docker exec -it skydexia90-ollama ollama pull llama3.2:3b
```

Optional Pro lane only if space allows:

```bash
docker exec -it skydexia90-ollama ollama pull deepseek-coder-v2:lite
```

## GPU mode

GPU mode requires Docker NVIDIA runtime support on the host.

Run:

```bash
bash run-docker-gpu.sh
```

If GPU support is not configured, use the normal CPU/basic launcher first.

## Stop

```bash
bash stop-docker.sh
```
