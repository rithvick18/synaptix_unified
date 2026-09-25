"""Run the service: ``python -m app`` (reads OBS_* settings, binds 127.0.0.1 by default)."""

import logging

import uvicorn

from .config import Settings


def main() -> None:
    settings = Settings()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        workers=1,  # in-memory sessions: exactly one worker
        ws_max_size=settings.max_ws_message_bytes,
        proxy_headers=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
