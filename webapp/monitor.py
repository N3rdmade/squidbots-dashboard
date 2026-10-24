"""The health of each realm, once a minute, at almost no cost to the servers.

What one round reads, per realm: is its worldserver process alive and its world port open, the process's memory and
processor time (Windows, directly: webapp/procinfo.py), and, when the world is up, one `server info` on its remote
console (players, characters in world, update diff: the "tick"). It never asks MySQL: the database is read only when a
page asks for figures. The bots online come from bot-status.json, which the server writes anyway.

Kept: one point a minute for the last 24 hours, one point every 10 minutes (averaged) for the last 7 days, and the
realm's events (started, stopped, crash report written) for the last 7 days, saved in the realm's data folder.
"""
import glob
import json
import os
import socket
import threading
import time

from . import procinfo, ra

DAY, WEEK = 24 * 3600, 7 * 24 * 3600
SAVE_EVERY = 300


def port_open(port):
    if not port:
        return False
    try:
        with socket.create_connection(("127.0.0.1", int(port)), timeout=0.6):
            return True
    except OSError:
        return False


def _read(path, empty):
    try:
        with open(path, encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, ValueError):
        return empty


class Track:
    """What the monitor keeps for one realm."""

    def __init__(self, path):
        self.path = path
        saved = _read(path, {})
        self.minutes = saved.get("minutes") or []
        self.tens = saved.get("tens") or []
        self.events = saved.get("events") or []
        self.state = {"running": False}
        self.pending = []          # minute points not yet folded into a 10-minute point
        self.crash_seen = saved.get("crashSeen") or time.time()
        self.saved = 0.0

    def add(self, point):
        now = point["ts"]
        self.minutes = [p for p in self.minutes if now - p["ts"] <= DAY] + [point]
        self.pending.append(point)
        if now - self.pending[0]["ts"] >= 540:
            self.tens = [p for p in self.tens if now - p["ts"] <= WEEK] + [fold(self.pending)]
            self.pending = []

    def event(self, kind, text=""):
        now = time.time()
        self.events = [e for e in self.events if now - e["ts"] <= WEEK][-199:] + [{"ts": round(now), "kind": kind, "text": text}]

    def save(self, force=False):
        if not force and time.time() - self.saved < SAVE_EVERY:
            return
        self.saved = time.time()
        body = json.dumps({"minutes": self.minutes, "tens": self.tens, "events": self.events,
                           "crashSeen": self.crash_seen}, separators=(",", ":"))
        try:
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
            with open(self.path + ".tmp", "w", encoding="utf-8") as handle:
                handle.write(body)
            os.replace(self.path + ".tmp", self.path)
        except OSError:
            pass


def fold(points):
    """Ten minute points as one: the mean of each figure (the maximum of the tick and of the memory too)."""
    out = {"ts": points[-1]["ts"], "up": round(sum(1 for p in points if p.get("up")) / len(points), 2)}
    for key in ("ram", "cpu", "tick", "players", "bots"):
        values = [p[key] for p in points if p.get(key) is not None]
        if values:
            out[key] = round(sum(values) / len(values), 1)
    for key in ("tick", "ram"):
        values = [p[key] for p in points if p.get(key) is not None]
        if values:
            out[key + "Max"] = max(values)
    return out


class Monitor:
    """`realms`: the Realm list; `root`: the repack (for the RA account); `bots_online(key)`: the bots in the
    realm's live snapshot, or None. `every` seconds between rounds; 0 turns sampling off (state is then read
    on demand, without history)."""

    def __init__(self, realms, root, bots_online, every=60, coa_exe=None, use_ra=True):
        self.realms = realms
        self.root = root
        self.bots_online = bots_online
        self.every = every
        self.coa_exe = (coa_exe or "").lower()
        self.use_ra = use_ra
        self.lock = threading.Lock()
        self.cpu = procinfo.CpuMeter()
        self.tracks = {r.key: Track(r.file("perf.json")) for r in realms}
        self._coa_ra = None

    # ---- the worldserver of each realm
    def _pid(self, realm, others):
        """The realm's worldserver pid: the one the launcher or manage.py recorded, when it is still a worldserver;
        for the CoA realm without a record, the worldserver of this repack that no other realm claims."""
        pid = realm.pid()
        if pid and procinfo.path_of(pid).lower().endswith("worldserver.exe"):
            return pid
        if realm.key != "coa":
            return 0
        running = procinfo.find("worldserver.exe")
        if self.coa_exe:
            for candidate, path in running.items():
                if path.lower() == self.coa_exe:
                    return candidate
            return 0
        root = os.path.normcase(os.path.abspath(self.root or "")) + os.sep
        for candidate, path in running.items():
            if candidate not in others and os.path.normcase(path).startswith(root):
                return candidate
        return 0

    def _ra_port(self, realm):
        if realm.ra_port:
            return realm.ra_port
        if self._coa_ra is None:
            self._coa_ra = ra.account(self.root)[2]
        return self._coa_ra

    def look(self, realm, others=(), with_ra=True):
        """The realm's state right now."""
        pid = self._pid(realm, others)
        listening = port_open(realm.world_port) if realm.world_port else None
        running = bool(pid) if listening is None else listening
        state = {"running": running, "starting": bool(pid) and listening is False, "pid": pid or None,
                 "ramMo": None, "cpu": None, "disabled": realm.disabled, "at": round(time.time())}
        if pid:
            sample = self.cpu.sample(pid)
            if sample:
                state["ramMo"], state["cpu"] = sample["ramMo"], sample["cpu"]
        if running and with_ra and self.use_ra:
            try:
                state.update(ra.parse_info(ra.command(self.root, self._ra_port(realm), "server info", timeout=6)))
                state["ra"] = True
            except ra.RaError as error:
                state["ra"], state["raError"] = False, str(error)
        state["bots"] = self.bots_online(realm.key) if running else None
        return state

    def round(self):
        pids = set()
        for realm in self.realms:
            pid = realm.pid()
            if pid:
                pids.add(pid)
        for realm in self.realms:
            track = self.tracks[realm.key]
            before = track.state
            try:
                state = self.look(realm, pids)
            except Exception as error:  # noqa: BLE001  one realm's trouble never stops the others
                state = {"running": False, "error": str(error), "at": round(time.time())}
            if before.get("running") != state.get("running") and "at" in before:
                track.event("start" if state.get("running") else "stop")
            for stamp in self._new_crashes(realm, track):
                track.event("crash", time.strftime("%d/%m %H:%M", time.localtime(stamp)))
            with self.lock:
                track.state = state
                track.add({"ts": state["at"], "up": 1 if state.get("running") else 0, "ram": state.get("ramMo"),
                           "cpu": state.get("cpu"), "tick": state.get("tickMean") or state.get("tick"),
                           "players": state.get("players"), "bots": state.get("bots")})
            track.save()

    def _new_crashes(self, realm, track):
        found = [os.path.getmtime(f) for folder in realm.crashes
                 for f in glob.glob(os.path.join(glob.escape(folder), "*.txt"))]
        new = sorted(t for t in found if t > track.crash_seen)
        if new:
            track.crash_seen = new[-1]
        return new

    def loop(self):
        while True:
            started = time.time()
            try:
                self.round()
            except Exception as error:  # noqa: BLE001
                print("Monitor round failed:", error, flush=True)
            time.sleep(max(5, self.every - (time.time() - started)))

    def start(self):
        if self.every:
            threading.Thread(target=self.loop, daemon=True).start()

    def stop(self):
        for track in self.tracks.values():
            track.save(force=True)

    # ---- what the pages read
    def state(self, key):
        """The realm's last known state. Without sampling, it is read now (without the console)."""
        track = self.tracks.get(key)
        if track is None:
            return {"running": False}
        if not self.every or "at" not in track.state or time.time() - track.state["at"] > max(180, 3 * self.every):
            realm = next(r for r in self.realms if r.key == key)
            with self.lock:
                track.state = self.look(realm, with_ra=False)
        return track.state

    def series(self, key, span="day"):
        track = self.tracks.get(key)
        if track is None:
            return {}
        with self.lock:
            return {"points": list(track.minutes if span == "day" else track.tens),
                    "events": list(track.events[-60:]), "state": dict(track.state), "every": self.every}
