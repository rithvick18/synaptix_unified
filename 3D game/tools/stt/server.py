"""Local speech-to-text for the picture chat, using faster-whisper.

The browser records the question (webm/opus, mp4 or ogg) and POSTs the raw bytes to
/transcribe; this returns {"text": "..."}. Audio never leaves the machine.

    python3 -m venv tools/stt/.venv
    tools/stt/.venv/bin/pip install -r tools/stt/requirements.txt
    tools/stt/.venv/bin/python tools/stt/server.py          # http://127.0.0.1:8765

Env: WHISPER_MODEL (default "small"), WHISPER_DEVICE ("auto"), WHISPER_COMPUTE ("int8"),
STT_PORT (8765). Vite proxies /stt to this server in `npm run dev`.
"""
import json
import os
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from faster_whisper import WhisperModel

MODEL = WhisperModel(
    os.environ.get("WHISPER_MODEL", "small"),
    device=os.environ.get("WHISPER_DEVICE", "auto"),
    compute_type=os.environ.get("WHISPER_COMPUTE", "int8"),
)
MAX_BYTES = 10 * 1024 * 1024  # 30 s of opus is far below this


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self) -> None:
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self) -> None:
        self._send(200, {"ok": True}) if urlparse(self.path).path == "/health" else self._send(404, {"error": "not found"})

    def do_POST(self) -> None:
        url = urlparse(self.path)
        if url.path != "/transcribe":
            return self._send(404, {"error": "not found"})
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BYTES:
            return self._send(400, {"error": "empty or oversized audio"})
        language = (parse_qs(url.query).get("lang") or [None])[0] or None
        with tempfile.NamedTemporaryFile(suffix=".audio") as f:
            f.write(self.rfile.read(length))
            f.flush()
            try:
                segments, _ = MODEL.transcribe(f.name, language=language, beam_size=5, vad_filter=True)
                text = " ".join(s.text.strip() for s in segments).strip()
            except Exception as error:  # undecodable audio
                return self._send(422, {"error": str(error)})
        self._send(200, {"text": text})

    def log_message(self, fmt: str, *args) -> None:
        pass


if __name__ == "__main__":
    port = int(os.environ.get("STT_PORT", "8765"))
    print(f"faster-whisper STT on http://127.0.0.1:{port}")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
