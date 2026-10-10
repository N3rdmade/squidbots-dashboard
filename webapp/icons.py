"""Item icons for the armory, taken from the player's own game client, one at a time.

Where an item's icon comes from:

  world.item_template.displayid   the item's look
  ItemDisplayInfo.dbc, field 5    the icon's file name for that look ("INV_Helmet_03")
  Interface\\Icons\\<name>.blp    the picture, inside the client's MPQ archives (BLP2 texture)

A Conquest of Azeroth client holds some 26,000 icons and a character sheet shows fifteen, so they are
not all extracted up front: the first time an icon is asked for, the dashboard reads it from the client
(tools/wowart.py: MPQ and BLP with the standard library only), writes it as a PNG in icons/ and serves
that file from then on. Only names that ItemDisplayInfo.dbc knows can be asked for, so no other file
of the client can be read this way.

The icons are Blizzard's art: icons/ is git-ignored and never shipped. Without a client
("gameClient" in dashboard.json, or a client found beside the repack), the armory keeps its
coloured frames.
"""
import os
import re
import sys
import threading

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))

NAME_RE = re.compile(r"^[a-z0-9_\-]{1,100}$")


class Icons:
    def __init__(self, folder, client_dir, dbc):
        self.folder, self.client_dir, self.dbc = folder, client_dir, dbc
        self.lock = threading.Lock()
        self.client, self.known = None, None

    @property
    def available(self):
        """Icons can be shown: a client to read them from (or some already extracted), and the item looks
        (ItemDisplayInfo.dbc) to name them."""
        has_client = bool(self.client_dir and os.path.isfile(os.path.join(self.client_dir, "Data", "common.MPQ")))
        return (has_client or os.path.isdir(self.folder)) and self.dbc.has("ItemDisplayInfo")

    def name_for(self, display_id):
        """The icon's file name for an item look, lower-cased, or ""."""
        return self.dbc.text("ItemDisplayInfo", int(display_id or 0), 5).lower()

    def _known_names(self):
        if self.known is None:
            table = self.dbc["ItemDisplayInfo"]
            self.known = {table.text(key, 5).lower() for key in table.rows} if table else set()
        return self.known

    def png(self, name):
        """The PNG's bytes for an icon name, extracted from the client the first time. None if unknown."""
        name = (name or "").lower()
        if not NAME_RE.match(name):
            return None
        path = os.path.join(self.folder, name + ".png")
        if os.path.exists(path):
            with open(path, "rb") as handle:
                return handle.read()
        if not self.client_dir or name not in self._known_names():
            return None
        with self.lock:
            if not os.path.exists(path):
                if self.client is None:
                    try:
                        import wowart                 # tools/wowart.py
                        self.client = wowart.Client(self.client_dir)
                    except Exception:                 # noqa: BLE001  not a readable client: frames only
                        self.client = False
                if not self.client:
                    return None
                try:
                    image = self.client.image("Interface\\Icons\\%s.blp" % name)
                    if image is None:
                        return None
                    os.makedirs(self.folder, exist_ok=True)
                    image.save_png(path)
                except Exception:                     # noqa: BLE001  an icon it cannot decode: the frame stays
                    return None
        with open(path, "rb") as handle:
            return handle.read()
