"""Game master tools for whoever runs the server from this PC: the dashboard's own page (127.0.0.1), never the
public copy nor the local network page.

Every action is one command of the realm's remote console (webapp/ra.py), the same command a GM would type in the
game, under the repack's console account. Nothing here writes the database: the server does, the way it always does.
Names, numbers and texts are checked before they reach the console (a line break there would be a second command),
and every action is written to data/gm-actions.jsonl with its answer.
"""
import json
import os
import re
import threading
import time

from . import ra

ACCOUNT = re.compile(r"^[A-Za-z0-9_]{1,32}$")
DURATION = re.compile(r"^(?:-1|\d{1,4}[smhdw]?(?:\d{1,4}[smhdw])*)$")
UNSTUCK = ("inn", "graveyard", "startzone")


class GmError(Exception):
    pass


def _text(value, limit, what):
    text = ra.clean(value)
    if not text:
        raise GmError("Write the %s." % what)
    if len(text) > limit:
        raise GmError("The %s is %d characters at most." % (what, limit))
    return text


def _quoted(value, limit, what):
    # Quoted for the console's own parser: an inner double quote would end the text early.
    return '"%s"' % _text(value, limit, what).replace('"', "'")


def _guid(value):
    """The character by its number: CoA names may hold a space ("Roah Test"), which the console would split, and
    every command that takes a character also takes its number."""
    try:
        guid = int(str(value).strip())
    except (TypeError, ValueError):
        raise GmError("Pick a character in the list.")
    if not 0 < guid < 2 ** 32:
        raise GmError("Pick a character in the list.")
    return str(guid)


def _account(body):
    account = str(body.get("account") or "").strip().upper()
    if not ACCOUNT.match(account):
        raise GmError("An account name is letters, digits and _ only.")
    return account


def _int(value, low, high, what):
    try:
        number = int(str(value).strip())
    except (TypeError, ValueError):
        raise GmError("The %s is a whole number." % what)
    if not low <= number <= high:
        raise GmError("The %s is between %d and %d." % (what, low, high))
    return number


# action: (needs a character, what the console gets). `body` is the request; the result is the command line.
def _command(action, body):
    target = lambda: _guid(body.get("guid"))  # noqa: E731
    if action == "announce":
        return ".announce " + _text(body.get("text"), 200, "message")
    if action == "notify":
        return ".notify " + _text(body.get("text"), 200, "message")
    if action == "saveall":
        return ".saveall"
    if action == "kick":
        reason = ra.clean(body.get("reason"))[:100]
        return ".kick %s%s" % (target(), " " + reason if reason else "")
    if action == "revive":
        return ".revive " + target()
    if action == "unstuck":
        where = str(body.get("where") or "inn")
        if where not in UNSTUCK:
            raise GmError("Unstuck to the inn, the graveyard or the start zone.")
        return ".unstuck %s %s" % (target(), where)
    if action == "mute":
        return ".mute %s %d %s" % (target(), _int(body.get("minutes"), 1, 10080, "duration in minutes"),
                                   _text(body.get("reason"), 100, "reason"))
    if action == "unmute":
        return ".unmute " + target()
    if action == "level":
        return ".character level %s %d" % (target(), _int(body.get("level"), 1, 80, "level"))
    if action == "money":
        copper = _int(body.get("gold"), 1, 100000, "amount of gold") * 10000
        return ".send money %s %s %s %d" % (target(), _quoted(body.get("subject") or "Gift", 60, "subject"),
                                            _quoted(body.get("text") or "From the game masters.", 200, "text"), copper)
    if action == "items":
        item = _int(body.get("item"), 1, 9999999, "item number")
        count = _int(body.get("count") or 1, 1, 200, "count")
        return ".send items %s %s %s %d:%d" % (target(), _quoted(body.get("subject") or "Gift", 60, "subject"),
                                               _quoted(body.get("text") or "From the game masters.", 200, "text"),
                                               item, count)
    if action == "ban":
        duration = str(body.get("duration") or "").strip().lower()
        if not DURATION.match(duration) or duration in ("0",):
            raise GmError("A duration like 30m, 12h, 7d, 2w, or -1 for ever.")
        return ".ban account %s %s %s" % (_account(body), duration, _text(body.get("reason"), 100, "reason"))
    if action == "unban":
        return ".unban account " + _account(body)
    if action == "gmlevel":
        return ".account set gmlevel %s %d -1" % (_account(body), _int(body.get("level"), 0, 3, "GM level"))
    if action == "ahbot":
        what = str(body.get("what") or "")
        if what not in ("update", "reload", "empty"):
            raise GmError("The auction house bot can update, reload or empty.")
        return ".ahbot " + what
    raise GmError("Unknown action.")


ACTIONS = ("announce", "notify", "saveall", "kick", "revive", "unstuck", "mute", "unmute", "level", "money", "items",
           "ban", "unban", "gmlevel", "ahbot")


class Gm:
    def __init__(self, root, query, journal):
        self.root, self.query, self.journal = root, query, journal
        self.lock = threading.Lock()

    def overview(self, ctx, ra_port, running):
        """The realm's players (not bots, not the auction house bot), online first, with their account."""
        db = ctx.db
        rows = self.query(
            "SELECT c.guid, c.name, c.level, c.class, c.race, c.online, c.zone, a.username, "
            "IFNULL((SELECT MAX(gmlevel) FROM {a}.account_access x WHERE x.id = a.id AND x.RealmID IN (-1, {rid})), 0), "
            "EXISTS(SELECT 1 FROM {a}.account_banned b WHERE b.id = a.id AND b.active = 1), "
            "c.logout_time, IFNULL(a.mutetime, 0) "
            "FROM {c}.characters c JOIN {a}.account a ON a.id = c.account "
            "WHERE a.username NOT LIKE '{bots}' AND a.username NOT LIKE 'AHBOT%' "
            "ORDER BY c.online DESC, c.logout_time DESC LIMIT 200".format(c=db["characters"], a=db["auth"],
                                                                            bots=ctx.bot_like, rid=ctx.realm.id))
        now = time.time()
        players = [{"guid": int(guid), "name": n, "level": int(l), "cls": int(c), "race": int(r), "online": o == "1", "zone": int(z),
                    "account": acc, "gm": int(g), "banned": b == "1", "lastSeen": int(seen or 0),
                    "muted": int(mute or 0) > now}
                   for guid, n, l, c, r, o, z, acc, g, b, seen, mute in rows]
        return {"realm": ctx.realm.public(), "console": running, "raPort": ra_port, "players": players,
                "journal": self.recent(ctx.realm.key)}

    def run(self, ctx, ra_port, body):
        action = str(body.get("action") or "")
        command = _command(action, body)
        try:
            answer, ok = ra.command(self.root, ra_port, command, timeout=12), True
        except ra.RaError as error:
            answer, ok = str(error), False
        # A refused command answers with the core's own message; the console has no exit code to read.
        if ok and re.search(r"(not found|no such|incorrect|wrong|syntax|unknown|does not exist|can't|cannot)", answer, re.I):
            ok = False
        self.write(ctx.realm.key, action, command, ok, answer)
        return {"ok": ok, "command": command, "answer": answer[:2000]}

    def write(self, realm, action, command, ok, answer):
        line = json.dumps({"ts": round(time.time()), "realm": realm, "action": action, "command": command, "ok": ok,
                           "answer": answer[:500]}, ensure_ascii=False)
        with self.lock:
            os.makedirs(os.path.dirname(self.journal), exist_ok=True)
            with open(self.journal, "a", encoding="utf-8") as handle:
                handle.write(line + "\n")

    def recent(self, realm, limit=25):
        try:
            with open(self.journal, "rb") as handle:
                handle.seek(0, os.SEEK_END)
                handle.seek(max(0, handle.tell() - 256 * 1024))
                lines = handle.read().decode("utf-8", "replace").splitlines()
        except OSError:
            return []
        out = []
        for line in reversed(lines):
            try:
                entry = json.loads(line)
            except ValueError:
                continue
            if entry.get("realm") == realm:
                out.append(entry)
                if len(out) >= limit:
                    break
        return out
