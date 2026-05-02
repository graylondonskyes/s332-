# SkyeDexia 90GB Edition Quickstart

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

In a second terminal:

```bash
cd ~/Downloads/skydexia-ai-brain-drive-90gb-edition-v0.1.0
source .env.skydexia
npm run smoke
```

Default models:

```txt
qwen2.5-coder:7b
phi4-mini
llama3.2:3b
```

Optional only if enough room remains:

```bash
bash scripts/pull-90gb-optional-pro-model.sh
```
