# Docker Product Truth

Docker makes SkyeDexia easier to run and deploy.

Docker does not make weak hardware fast.

The Docker stack runs:

- SkyeDexia app/router container
- Ollama model runtime container
- external mounted model vault

The host still provides:

- CPU
- GPU if available
- RAM
- storage speed
- Docker support
