# QUICKSTART — SkyeDexia 90GB Integrated v0.2.0

## Local mode

```bash
npm install
bash scripts/setup-90gb-drive.sh "/mnt/chromeos/removable/YOUR_DRIVE_NAME"
source .env.skydexia
npm run check
bash scripts/pull-90gb-lite-models.sh
npm run start
```

Open:

```txt
http://localhost:8787
```

## Docker mode

```bash
cp .env.docker.example .env.docker
nano .env.docker
bash run-docker.sh
```

Open:

```txt
http://localhost:8787
```

Pull models:

```bash
docker exec -it skydexia90-ollama ollama pull qwen2.5-coder:7b
docker exec -it skydexia90-ollama ollama pull phi4-mini
docker exec -it skydexia90-ollama ollama pull llama3.2:3b
```
