#!/usr/bin/env python3
"""Send a message or inspect a persisted chat through its local Emacs socket."""
import argparse
import json
import os
import socket
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", help="Chat directory")
    parser.add_argument("text", nargs="?", help="Message; a second invocation during work steers it")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--zoom", nargs=2, type=int, metavar=("ID", "N"))
    group.add_argument("--date", type=int, metavar="ID")
    group.add_argument("--stop", action="store_true")
    group.add_argument("--note", action="store_true", help="Import text as a memory without a user turn")
    parser.add_argument("--page", type=int, default=0)
    args = parser.parse_args()
    if args.zoom:
        request = {"action": "zoom", "id": args.zoom[0], "n": args.zoom[1], "page": args.page}
    elif args.date is not None:
        request = {"action": "date", "id": args.date}
    elif args.stop:
        request = {"action": "stop"}
    elif args.note:
        if args.text is None:
            parser.error("--note requires text")
        request = {"action": "note", "text": args.text}
    elif args.text is not None:
        request = {"action": "send", "text": args.text}
    else:
        parser.error("Provide a message, --zoom, --date, or --stop")
    try:
        with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
            client.connect(os.path.join(os.path.abspath(args.directory), "session.sock"))
            client.sendall((json.dumps(request, ensure_ascii=False) + "\n").encode("utf-8"))
            with client.makefile("r", encoding="utf-8") as stream:
                line = stream.readline()
                if not line:
                    raise RuntimeError("Chat server closed before replying")
                response = json.loads(line)
                status = response["status"]
                if status == "error":
                    raise RuntimeError(response["message"])
                if status == "reply":
                    print(response["text"])
                elif status == "data":
                    print(json.dumps(response["value"], ensure_ascii=False, indent=2))
                else:
                    print(status)
    except (OSError, ValueError, RuntimeError) as error:
        print(f"slopchat: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
