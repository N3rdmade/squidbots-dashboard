"""The auction house of a realm: what is for sale, by whom, at what price. Read-only, two queries, kept two minutes.

auctionhouse (characters database) holds one row per auction: the item (item_instance: entry and stack size), its
seller (a character), its buyout and bids, and when it ends. The seller is the auction house bot (mod-ah-bot-plus:
its characters live on the AHBOT account), a random bot of the realm, or a player. Houses: 1 to 6 are the faction
houses (2 Alliance, 6 Horde in 3.3.5), 7 is the neutral one (Booty Bay, Gadgetzan, Everlook).
"""
import json
import threading
import time

EVERY = 120
HISTORY_EVERY = 15 * 60
HISTORY_KEEP = 7 * 24 * 3600
HOUSES = {2: "alliance", 6: "horde", 7: "neutral"}


def _house(house):
    return HOUSES.get(int(house), "alliance" if int(house) < 6 else "neutral")


class Market:
    def __init__(self, query, ctx):
        self.query, self.ctx = query, ctx
        self.lock = threading.Lock()
        self.at, self.data = 0.0, None
        self.history_file = ctx.file("market-history.json")
        try:
            self.history = json.load(open(self.history_file, encoding="utf-8"))
        except (OSError, ValueError):
            self.history = []

    def get(self):
        with self.lock:
            if self.data is None or time.time() - self.at > EVERY:
                try:
                    self.data = self.collect()
                except Exception as error:  # noqa: BLE001  the page says why and keeps the last figures
                    data = dict(self.data or {})
                    data["error"] = str(error)
                    self.data = data
                self.at = time.time()
            return self.data

    def collect(self):
        db, bots = self.ctx.db, self.ctx.bot_like
        seller = ("CASE WHEN a.username LIKE 'AHBOT%%' THEN 'ahbot' WHEN a.username LIKE '%s' THEN 'bots' "
                  "WHEN a.id IS NULL THEN 'gone' ELSE 'players' END" % bots)
        joins = ("FROM {c}.auctionhouse h JOIN {c}.item_instance i ON i.guid = h.itemguid "
                 "LEFT JOIN {w}.item_template t ON t.entry = i.itemEntry "
                 "LEFT JOIN {c}.characters c ON c.guid = h.itemowner "
                 "LEFT JOIN {a}.account a ON a.id = c.account ").format(c=db["characters"], w=db["world"], a=db["auth"])
        rows = self.query(
            "SELECT h.houseid, IFNULL(t.Quality, 1), IFNULL(t.class, 15), %s, COUNT(*), SUM(h.buyoutprice), "
            "SUM(h.buyoutprice > 0), SUM(h.buyguid <> 0), SUM(i.count), SUM(h.time < UNIX_TIMESTAMP() + 3600), "
            "SUM(IF(h.buyoutprice > 0, h.buyoutprice / GREATEST(i.count, 1), 0)) "
            "%s GROUP BY 1, 2, 3, 4" % (seller, joins))
        totals = {"auctions": 0, "value": 0, "withBuyout": 0, "withBids": 0, "items": 0, "endingSoon": 0}
        by = {"house": {}, "quality": {}, "class": {}, "seller": {}}
        for house, quality, cls, who, n, value, buyouts, bids, items, soon, _unit in rows:
            n, value = int(n), int(float(value or 0))
            totals["auctions"] += n
            totals["value"] += value
            totals["withBuyout"] += int(float(buyouts or 0))
            totals["withBids"] += int(float(bids or 0))
            totals["items"] += int(float(items or 0))
            totals["endingSoon"] += int(float(soon or 0))
            for kind, key in (("house", _house(house)), ("quality", int(quality)), ("class", int(cls)), ("seller", who)):
                entry = by[kind].setdefault(key, {"key": key, "auctions": 0, "value": 0})
                entry["auctions"] += n
                entry["value"] += value
        priciest = self.query(
            "SELECT IFNULL(t.name, CONCAT('#', i.itemEntry)), i.itemEntry, IFNULL(t.Quality, 1), i.count, "
            "h.buyoutprice, GREATEST(h.lastbid, h.startbid), h.time - UNIX_TIMESTAMP(), h.houseid, %s, "
            "IFNULL(t.ItemLevel, 0) %s WHERE h.buyoutprice > 0 ORDER BY h.buyoutprice DESC LIMIT 15" % (seller, joins))
        top = [{"name": name, "item": int(entry), "quality": int(quality), "count": int(count),
                "buyout": int(buyout), "bid": int(bid), "left": max(0, int(left)), "house": _house(house),
                "seller": who, "ilvl": int(ilvl)}
               for name, entry, quality, count, buyout, bid, left, house, who, ilvl in priciest]
        now = time.time()
        if not self.history or now - self.history[-1]["ts"] >= HISTORY_EVERY:
            ahbot = by["seller"].get("ahbot", {}).get("auctions", 0)
            self.history = [p for p in self.history if now - p["ts"] <= HISTORY_KEEP]
            self.history.append({"ts": round(now), "auctions": totals["auctions"], "value": totals["value"],
                                 "ahbot": ahbot})
            try:
                with open(self.history_file, "w", encoding="utf-8") as handle:
                    json.dump(self.history, handle, separators=(",", ":"))
            except OSError:
                pass
        order = lambda group: sorted(group.values(), key=lambda e: e["auctions"], reverse=True)  # noqa: E731
        return {"realm": self.ctx.realm.public(), "at": round(now), "totals": totals,
                "houses": order(by["house"]), "qualities": sorted(by["quality"].values(), key=lambda e: e["key"]),
                "classes": order(by["class"]), "sellers": order(by["seller"]), "top": top,
                "history": self.history}
