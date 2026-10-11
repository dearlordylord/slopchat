#!/usr/bin/env python3
"""Exercise the migrated application over its real socket with fake inference."""
import json
import pathlib
import socket
import subprocess
import tempfile
import time

root = pathlib.Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="memory-module-cli-") as directory:
    endpoint = pathlib.Path(directory) / "session.sock"
    form = (
        '(progn (setq slopchat-turn-function '
        '(lambda (_chat _prompt done) (funcall done "module reply" nil)) '
        'slopchat-summary-function '
        '(lambda (_chat _node _prompt _context done) (funcall done "user: retained source" nil))) '
        f'(slopchat-serve {json.dumps(directory)}))'
    )
    with open(pathlib.Path(directory) / "server.log", "w+") as log:
        process = subprocess.Popen(
            ["emacs", "--batch", "-Q", "-L", str(root / "lisp"), "-l", "slopchat-cli", "--eval", form],
            cwd=root, stdout=log, stderr=log,
        )
        def request(payload, replies=1):
            with socket.socket(socket.AF_UNIX) as connection:
                connection.settimeout(10)
                connection.connect(str(endpoint))
                connection.sendall((json.dumps(payload) + "\n").encode())
                with connection.makefile() as incoming:
                    return [json.loads(incoming.readline()) for _ in range(replies)]
        try:
            deadline = time.monotonic() + 10
            while not endpoint.exists():
                if process.poll() is not None or time.monotonic() > deadline:
                    log.seek(0)
                    raise RuntimeError(log.read())
                time.sleep(0.05)
            assert request({"action": "note", "text": "prior"})[0]["value"] == [0]
            accepted, reply = request({"action": "send", "ack": True, "text": "q" * 600}, replies=2)
            assert accepted == {"status": "accepted", "value": 1}
            assert reply == {"status": "reply", "text": "module reply"}
            status = request({"action": "status"})[0]["value"]
            assert status["count"] == status["cursor"] == 3
            assert status["summaryActive"] == status["summaryFailed"] == 0
            assert status["memoryUsage"]["started"] == 1
            assert status["memoryUsage"]["cachedInputObserved"] == 0
            history = request({"action": "history"})[0]["value"]
            assert len(history["messages"]) == 3
            assert request({"action": "zoom", "id": 1, "n": 1})[0]["value"]["text"] == "q" * 600
            call = request({"action": "context-calls"})[0]["value"]["calls"][0]
            detail = request({"action": "context", "id": call["id"], "section": "events"})[0]["value"]
            assert detail["kind"] == "compaction" and "summary-validation" in detail["text"]
            request({"action": "stop"})
            assert process.wait(timeout=10) == 0
            assert not endpoint.exists()
            result = {"passed": True, "isolated": True, "records": 3, "durableAcceptanceBeforeReply": True,
                      "historyAndZoom": True, "attemptInspection": True, "unknownCachePreserved": True,
                      "orderlyShutdown": True, "summaryActive": 0, "summaryFailed": 0}
            pathlib.Path("/tmp/memory-module-cli.json").write_text(json.dumps(result))
            print(json.dumps(result))
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=10)
