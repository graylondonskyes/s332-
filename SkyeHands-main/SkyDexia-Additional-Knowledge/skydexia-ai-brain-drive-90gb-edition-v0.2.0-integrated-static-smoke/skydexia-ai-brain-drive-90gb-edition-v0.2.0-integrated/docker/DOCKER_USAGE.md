# Docker Usage

## Start CPU/basic mode

```bash
bash run-docker.sh
```

## Start GPU mode

```bash
bash run-docker-gpu.sh
```

## Stop

```bash
bash stop-docker.sh
```

## Pull models

```bash
docker exec -it skydexia90-ollama ollama pull qwen2.5-coder:7b
docker exec -it skydexia90-ollama ollama pull phi4-mini
docker exec -it skydexia90-ollama ollama pull llama3.2:3b
```

Optional:

```bash
docker exec -it skydexia90-ollama ollama pull deepseek-coder-v2:lite
```

## Verify

```bash
curl http://localhost:8787/api/health
curl http://localhost:8787/api/models
curl http://localhost:8787/api/space
```
