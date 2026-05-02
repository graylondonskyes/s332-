# Static Sandbox Smoke Summary

Overall status: `pass_static_sandbox_smoke`

## Passed
- ✅ required file inventory
- ✅ valid json package.json
- ✅ valid json models/90gb-models.manifest.json
- ✅ valid json proof/INTEGRATION_VALIDATION_V0.2.0.json
- ✅ server contains route /api/health
- ✅ server contains route /api/models
- ✅ server contains route /api/hardware
- ✅ server contains route /api/space
- ✅ server contains route /api/chat
- ✅ docker file present Dockerfile
- ✅ docker file present docker-compose.yml
- ✅ docker file present docker-compose.gpu.yml
- ✅ compose has ollama service
- ✅ compose has app service
- ✅ gpu compose has nvidia reservation
- ✅ javascript file nonempty src/server.mjs
- ✅ javascript file nonempty scripts/hardware-check.mjs
- ✅ javascript file nonempty scripts/smoke-local.mjs
- ✅ bash file has strict mode scripts/setup-90gb-drive.sh
- ✅ bash file has strict mode scripts/check-drive-space.sh
- ✅ bash file has strict mode scripts/pull-90gb-lite-models.sh
- ✅ bash file has strict mode run-docker.sh

## Hard failures
- None

## Not proven here
- ☐ Physical 90GB drive setup
- ☐ Actual Ollama model pull
- ☐ Docker runtime
- ☐ GPU runtime
- ☐ Browser automation