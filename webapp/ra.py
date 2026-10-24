"""The worldserver's remote console (RA): one command, its answer. The same account and the same rules as the launcher
(src/live.cjs): 127.0.0.1 only, the repack's account from Settings\\repack.json (raUsername / raPassword, "local" by
default), and the connection is never closed while the world may still write its answer, because cores before CoA
Bots 2.4 crash when they write to a closed RA connection. After the timeout the caller gets its error, but a reader
thread keeps the connection until the answer and the next prompt came (10 minutes at most).
"""
import json
import os
import re
import socket
import threading
import time

PROMPT = re.compile(r"AC>\s*$")
LINGER = 600


class RaError(Exception):
    pass


def account(root):
    """(user, password, CoA realm's RA port) from the repack's settings."""
    try:
        with open(os.path.join(root, "Settings", "repack.json"), encoding="utf-8-sig") as handle:
            settings = json.load(handle)
    except (OSError, ValueError):
        settings = {}
    return (str(settings.get("raUsername") or "local"), str(settings.get("raPassword") or "local"),
            int(settings.get("raPort") or 3443))


def clean(text):
    """One line for the console: no line break (it would send a second command), no control character."""
    return re.sub(r"[\x00-\x1f\x7f]+", " ", str(text or "")).strip()


def command(root, port, line, timeout=10.0):
    """Run `line` on the console at `port`; its answer as text. RaError when the world does not answer."""
    user, password, _ = account(root)
    line = clean(line)
    try:
        sock = socket.create_connection(("127.0.0.1", int(port)), timeout=2.0)
    except OSError:
        raise RaError("The world console is not reachable: is this realm's worldserver running?")
    state = {"step": 0, "data": "", "answer": None, "error": None}
    done = threading.Event()

    def reader():
        deadline = time.time() + LINGER
        sock.settimeout(1.0)
        try:
            while time.time() < deadline:
                try:
                    chunk = sock.recv(65536)
                except socket.timeout:
                    if state["step"] < 3 and time.time() > started + timeout:
                        break               # not logged in yet: nothing is waiting to be written, close now
                    continue
                if not chunk:
                    break
                state["data"] = (state["data"] + chunk.decode("utf-8", "replace"))[-262144:]
                data = state["data"]
                if state["step"] == 0 and "Username:" in data:
                    state["step"], state["data"] = 1, ""
                    sock.sendall((user + "\r\n").encode("utf-8"))
                elif state["step"] == 1 and "Password:" in data:
                    state["step"], state["data"] = 2, ""
                    sock.sendall((password + "\r\n").encode("utf-8"))
                elif state["step"] == 2 and PROMPT.search(data):
                    state["step"], state["data"] = 3, ""
                    sock.sendall((line + "\r\n").encode("utf-8"))
                elif state["step"] == 2 and re.search(r"failed|denied|wrong", data, re.I):
                    state["error"] = "The world console refused the repack account (Settings\\repack.json)."
                    break
                elif state["step"] == 3 and PROMPT.search(data):
                    state["answer"] = PROMPT.sub("", data).strip()
                    break
        except OSError as error:
            state["error"] = "The world console closed the connection (%s)." % error
        finally:
            done.set()
            try:
                sock.close()
            except OSError:
                pass

    started = time.time()
    threading.Thread(target=reader, daemon=True).start()
    if not done.wait(timeout) or state["answer"] is None:
        raise RaError(state["error"] or "The world console did not answer in time.")
    return state["answer"]


def parse_info(text):
    """`server info`: players, characters in world, update diff (tick) and its mean, uptime."""
    def number(pattern):
        match = re.search(pattern, text, re.I)
        return int(match.group(1)) if match else None
    uptime = re.search(r"uptime:\s*([^\r\n.]+)", text, re.I)
    players = number(r"Connected players:\s*(\d+)")
    return {
        "players": players if players is not None else number(r"players online:\s*(\d+)"),
        "characters": number(r"Characters in world:\s*(\d+)"),
        "tick": number(r"Update time diff:\s*(\d+)"),
        "tickMean": number(r"(?:Mean|average)[^\d]{0,12}(\d+)\s*ms"),
        "uptime": uptime.group(1).strip() if uptime else "",
    }
