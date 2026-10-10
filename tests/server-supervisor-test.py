"""Exercise crash recovery, exclusive ownership, and intentional shutdown."""
import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parent.parent


class SupervisorTest(unittest.TestCase):
    def launch(self, directory, body):
        fake = directory / 'fake-emacs'
        fake.write_text('#!/usr/bin/env python3\n' + body)
        fake.chmod(0o700)
        return subprocess.Popen([str(ROOT / 'scripts/chat-server'), str(directory)],
                                env=dict(os.environ, SLOPCHAT_EMACS=str(fake)),
                                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    def events(self, directory):
        path = directory / 'supervisor.log'
        return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []

    def wait_event(self, directory, event):
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            rows = self.events(directory)
            if any(row['event'] == event for row in rows):
                return rows
            time.sleep(.05)
        self.fail('Missing event: ' + event)

    def cleanup(self, process):
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=12)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
        process.stderr.close()

    def test_child_survives_broken_pipe(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            fake = directory / 'fake-emacs'
            # Unlike Python, a shell does not install its own SIGPIPE ignore.
            fake.write_text(chr(10).join([
                '#!/bin/sh', 'kill -PIPE $$', 'exit 0', '']))
            fake.chmod(0o700)
            process = subprocess.Popen([str(ROOT / 'scripts/chat-server'), str(directory)],
                env=dict(os.environ, SLOPCHAT_EMACS=str(fake)),
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            try:
                process.wait(timeout=8)
                self.assertEqual(process.returncode, 0)
                rows = self.events(directory)
                self.assertEqual(sum(row['event'] == 'started' for row in rows), 1)
                self.assertEqual([row['exitCode'] for row in rows
                                  if row['event'] == 'exited'], [0])
            finally:
                self.cleanup(process)

    def test_sigkill_restarts_and_clean_exit_stops(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            process = self.launch(directory, "import os, pathlib, signal\np=pathlib.Path('" + tmp + "/attempt')\nif not p.exists():\n p.touch()\n os.kill(os.getpid(), signal.SIGKILL)\n")
            try:
                process.wait(timeout=8)
                self.assertEqual(process.returncode, 0)
                rows = self.events(directory)
                self.assertEqual(sum(row['event'] == 'started' for row in rows), 2)
                exits = [row for row in rows if row['event'] == 'exited']
                self.assertEqual([row['exitCode'] for row in exits], [-9, 0])
                self.assertFalse((directory / 'supervisor.pid').exists())
            finally:
                self.cleanup(process)

    def test_adoption_does_not_interrupt_active_server(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            fake = directory / 'fake-emacs'
            fake.write_text('#!/usr/bin/env python3\n')
            fake.chmod(0o700)
            existing = subprocess.Popen(['sleep', '60'])
            process = subprocess.Popen([str(ROOT / 'scripts/chat-server'), tmp,
                                        '--adopt', str(existing.pid)],
                                       env=dict(os.environ, SLOPCHAT_EMACS=str(fake)),
                                       stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            try:
                rows = self.wait_event(directory, 'adopted')
                self.assertIsNone(existing.poll())
                self.assertFalse(any(row['event'] == 'started' for row in rows))
                existing.kill()
                existing.wait()
                process.wait(timeout=8)
                rows = self.events(directory)
                self.assertTrue(any(row['event'] == 'adopted-exit' for row in rows))
                self.assertEqual(sum(row['event'] == 'started' for row in rows), 1)
            finally:
                self.cleanup(process)
                if existing.poll() is None:
                    existing.kill()
                    existing.wait()

    def test_requested_stop_waits_and_kills_adopted_server(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            ready = directory / 'ready'
            existing = subprocess.Popen(['python3', '-c',
                "import signal,time,pathlib; signal.signal(signal.SIGTERM,signal.SIG_IGN); "
                + "pathlib.Path(" + repr(str(ready)) + ").touch(); time.sleep(60)"])
            process = None
            try:
                deadline = time.monotonic() + 3
                while not ready.exists() and time.monotonic() < deadline:
                    time.sleep(.01)
                self.assertTrue(ready.exists())
                process = subprocess.Popen([str(ROOT / 'scripts/chat-server'), tmp,
                                            '--adopt', str(existing.pid)],
                                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
                self.wait_event(directory, 'adopted')
                process.terminate()
                process.wait(timeout=13)
                self.assertEqual(process.returncode, 0)
                self.assertEqual(existing.wait(timeout=1), -signal.SIGKILL)
                self.assertFalse((directory / 'supervisor.pid').exists())
                self.assertTrue(any(row['event'] == 'adopted-stopped' for row in self.events(directory)))
            finally:
                if process is not None:
                    self.cleanup(process)
                if existing.poll() is None:
                    existing.kill()
                    existing.wait()

    def test_exclusive_owner_and_requested_stop(self):
        with tempfile.TemporaryDirectory() as tmp:
            directory = Path(tmp)
            process = self.launch(directory, 'import time\ntime.sleep(60)\n')
            try:
                self.wait_event(directory, 'started')
                other = subprocess.run([str(ROOT / 'scripts/chat-server'), tmp], capture_output=True, timeout=3)
                self.assertNotEqual(other.returncode, 0)
                self.assertIn(b'already owns', other.stderr)
                process.terminate()
                process.wait(timeout=12)
                rows = self.events(directory)
                self.assertEqual(sum(row['event'] == 'started' for row in rows), 1)
                self.assertTrue(next(row for row in rows if row['event'] == 'exited')['requested'])
            finally:
                self.cleanup(process)


if __name__ == '__main__':
    unittest.main()
