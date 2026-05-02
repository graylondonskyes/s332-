"""Minimal OpenHands v1 router contract used by SkyeQuanta runtime probes.

The production SkyeQuanta app server is implemented in ``skyequanta_app_server``.
This module supplies the canonical ``openhands.app_server.v1_router.router``
symbol so the in-house package is importable without a network install.
"""

from dataclasses import dataclass, field


@dataclass(frozen=True)
class SkyeQuantaOpenHandsRouter:
    name: str = "skyequanta-openhands-v1"
    runtime: str = "in-house"
    routes: tuple[str, ...] = field(default_factory=lambda: (
        "/health",
        "/capabilities",
        "/docs",
        "/api/workspace/summary",
        "/api/files",
        "/api/file",
    ))


router = SkyeQuantaOpenHandsRouter()

