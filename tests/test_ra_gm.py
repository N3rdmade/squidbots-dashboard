"""The console client and the GM command lines, against a fake world console (no server needed).

    python -B tests/test_ra_gm.py
"""
import os
import socket
import sys
import tempfile
import threading
import unittest

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, HERE)

from webapp import gm, monitor, ra, realms  # noqa: E402


def fake_console(answer, received):
    """A world console on a free port: asks for the account, then answers one command with `answer`."""
    server = socket.socket()
    server.bind(("127.0.0.1", 0))
    server.listen(1)

    def serve():
        conn, _ = server.accept()
        conn.sendall(b"Authentication Required\r\nUsername: ")
        received.append(conn.recv(100).decode().strip())
        conn.sendall(b"Password: ")
        received.append(conn.recv(100).decode().strip())
        conn.sendall(b"+Logged in.\r\nAC>")
        received.append(conn.recv(200).decode().strip())
        conn.sendall(answer.encode() + b"\r\nAC>")
        conn.recv(10)
        conn.close()
        server.close()
    threading.Thread(target=serve, daemon=True).start()
    return server.getsockname()[1]


class ConsoleTest(unittest.TestCase):
    def test_server_info(self):
        received = []
        port = fake_console("AzerothCore rev. x\r\nConnected players: 3. Characters in world: 412.\r\n"
                            "Server uptime: 2 hour(s) 5 minute(s).\r\nUpdate time diff: 61ms. Last 500 diffs summary:\r\n"
                            "|- Mean: 58ms", received)
        root = tempfile.mkdtemp()
        info = ra.parse_info(ra.command(root, port, "server info", timeout=5))
        self.assertEqual(received, ["local", "local", "server info"])
        self.assertEqual((info["players"], info["characters"], info["tick"], info["tickMean"]), (3, 412, 61, 58))

    def test_no_line_break_reaches_the_console(self):
        self.assertEqual(ra.clean("hello\r\n.server shutdown 1"), "hello .server shutdown 1")

    def test_unreachable(self):
        with self.assertRaises(ra.RaError):
            ra.command(tempfile.mkdtemp(), 1, "server info", timeout=2)


class GmTest(unittest.TestCase):
    def test_lines(self):
        self.assertEqual(gm._command("kick", {"guid": "42"}), ".kick 42")
        self.assertEqual(gm._command("unstuck", {"guid": 42, "where": "graveyard"}), ".unstuck 42 graveyard")
        self.assertEqual(gm._command("mute", {"guid": 42, "minutes": "15", "reason": "spam"}), ".mute 42 15 spam")
        self.assertEqual(gm._command("money", {"guid": 42, "gold": 5, "subject": 'Say "hi"', "text": "x"}),
                         '.send money 42 "Say \'hi\'" "x" 50000')
        self.assertEqual(gm._command("ban", {"account": "bob", "duration": "7d", "reason": "cheat"}),
                         ".ban account BOB 7d cheat")
        self.assertEqual(gm._command("gmlevel", {"account": "bob", "level": 2}), ".account set gmlevel BOB 2 -1")
        self.assertEqual(gm._command("announce", {"text": "Restart in 5 min\r\n.server shutdown 1"}),
                         ".announce Restart in 5 min .server shutdown 1")

    def test_refused(self):
        for action, body in (("kick", {"guid": "Roah Test"}), ("kick", {}), ("mute", {"guid": 4, "minutes": "x"}),
                             ("ban", {"account": "BOB", "duration": "forever", "reason": "x"}), ("level", {"guid": 4, "level": 99}),
                             ("unban", {"account": "a;b"}), ("ahbot", {"what": "shutdown"}), ("announce", {"text": ""}), ("nope", {})):
            with self.assertRaises(gm.GmError, msg=action):
                gm._command(action, body)


class RealmsTest(unittest.TestCase):
    def test_discover(self):
        root, here = tempfile.mkdtemp(), tempfile.mkdtemp()
        place = os.path.join(root, "Royaumes", "wildcard")
        os.makedirs(os.path.join(place, "configs", "modules"))
        open(os.path.join(place, "configs", "worldserver.conf"), "w").close()
        with open(os.path.join(place, "configs", "modules", "playerbots.conf"), "w") as handle:
            handle.write('AiPlayerbot.RandomBotAccountPrefix = "rndwc"\n')
        with open(os.path.join(place, "realm.json"), "w") as handle:
            handle.write('{"id": 2, "name": "Darkmoon", "worldPort": 8185, "raPort": 3543}')
        os.makedirs(os.path.join(root, "Royaumes", "reborn"))          # never started: no configs, not listed
        coa = realms.Realm("coa", 1, "CoA", {"auth": "acore_auth", "characters": "acore_characters",
                                              "world": "acore_world"}, root, root, [], here, "rndbot", here=here)
        found = realms.discover(root, {}, here, coa)
        self.assertEqual([r.key for r in found], ["coa", "wildcard"])
        wildcard = found[1]
        self.assertEqual((wildcard.bot_like, wildcard.db["characters"], wildcard.ra_port), ("RNDWC%", "acore_characters_wildcard", 3543))
        self.assertTrue(wildcard.file("perf.json").startswith(os.path.join(here, "data", "wildcard")))
        self.assertEqual(coa.file("history.json"), os.path.join(here, "history.json"))

    def test_ports_never_the_coa_realms(self):
        root, here = tempfile.mkdtemp(), tempfile.mkdtemp()
        place = os.path.join(root, "Royaumes", "reborn")
        os.makedirs(os.path.join(place, "configs", "modules"))
        with open(os.path.join(place, "configs", "worldserver.conf"), "w") as handle:
            handle.write("WorldServerPort = 8312" + chr(10) + "Ra.Port = 3660" + chr(10))
        with open(os.path.join(place, "realm.json"), "w") as handle:
            handle.write('{"id": 3}')
        coa = realms.Realm("coa", 1, "CoA", {"auth": "a", "characters": "c", "world": "w"}, root, root, [], here, "rndbot", here=here)
        reborn = realms.discover(root, {}, here, coa)[1]
        self.assertEqual((reborn.world_port, reborn.ra_port), (8312, 3660))
        os.remove(os.path.join(place, "configs", "worldserver.conf"))
        open(os.path.join(place, "configs", "worldserver.conf"), "w").close()
        reborn = realms.discover(root, {}, here, coa)[1]
        self.assertEqual((reborn.world_port, reborn.ra_port), (8285, 3643))      # the launcher's rule: CoA's + 200
        with self.assertRaises(ra.RaError):
            ra.command(root, 0, "server info")

    def test_own_settings(self):
        root = tempfile.mkdtemp()
        os.makedirs(os.path.join(root, "Royaumes", "reborn"))
        written = realms.write_own_settings(root, "reborn", {"playerbots.conf": {"AiPlayerbot.MaxRandomBots": "40",
                                                                                 "AiPlayerbot.RandomBotAccountPrefix": "x"}})
        self.assertEqual(written, ["AiPlayerbot.MaxRandomBots"])
        self.assertEqual(realms.own_settings(root, "reborn"), {"playerbots.conf": {"AiPlayerbot.MaxRandomBots": "40"}})


class MonitorTest(unittest.TestCase):
    def test_world_gone_with_its_pid_recorded_is_a_crash(self):
        here = tempfile.mkdtemp()
        realm = realms.Realm("reborn", 3, "Reborn", {"auth": "a", "characters": "c", "world": "w"}, here, here, [], here,
                             "rndwr", here=here)
        realm.pid = lambda: 42                         # the launcher still records pid 42: nobody stopped it
        watch = monitor.Monitor([realm], here, lambda key: None, every=60, use_ra=False)
        states = iter([{"running": True, "pid": 42, "at": 1}, {"running": False, "pid": None, "at": 2}])
        watch.look = lambda realm, others=(), with_ra=True: next(states)
        watch.round()
        watch.round()
        self.assertEqual([e["kind"] for e in watch.tracks["reborn"].events], ["down"])
        self.assertEqual(len(watch.downs("reborn", 0)), 1)


if __name__ == "__main__":
    unittest.main()
