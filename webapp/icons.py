"""Item icons for the armory: the icon's name from the server, the picture from a local client or the web.

The chain, in order:

  1. The icon's name for an item's look (world.item_template.displayid):
       world.itemdisplayinfo_dbc, InventoryIcon_1   the server's own table; Conquest of Azeroth adds its
                                                    custom looks there (the core reads it over the DBC)
       ItemDisplayInfo.dbc, field 5                 the server's data/dbc file, for the looks the table lacks
  2. The picture from a game client on this PC, if one is known: Interface\\Icons\\<name>.blp inside its
     MPQ archives, read the first time a sheet shows it (tools/wowart.py: MPQ and BLP with the standard
     library only), written as a PNG in icons/ and served from there as icons/<name>.png. The client is
     "gameClient" in dashboard.json, or one found beside the repack or in a usual install folder.
     Only names step 1 gave can be asked for, so no other file of the client can be read this way.
  3. Otherwise the visitor's browser loads https://wow.zamimg.com/images/wow/icons/large/<name>.jpg
     (Wowhead's copy of the game's icons). Custom CoA icons are not there: the page then keeps the
     quality-coloured frame. "webIcons": false in dashboard.json turns this step off (the browser then
     asks no outside site for anything).

The icons are Blizzard's art: icons/ is git-ignored and never shipped.
"""
import os
import re
import string
import sys
import threading

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tools"))

NAME_RE = re.compile(r"^[a-z0-9_\-]{1,100}$")
WEB_URL = "https://wow.zamimg.com/images/wow/icons/large/%s.jpg"

# Usual places of a 3.3.5 / Ascension client, under each drive's root and Program Files.
CLIENT_PLACES = ("Ascension Launcher/resources/client", "Ascension Launcher/resources/ascension-live",
                 "Ascension Launcher/resources/epoch-live", "Ascension", "Ascension/client", "World of Warcraft",
                 "Games/Ascension", "Games/World of Warcraft", "Games/Ascension Launcher/resources/client",
                 "Games/Ascension Launcher/resources/ascension-live", "Conquest of Azeroth", "Games/Conquest of Azeroth")


def is_client(folder):
    return bool(folder) and os.path.isfile(os.path.join(folder, "Data", "common.MPQ"))


def _fixed_drive(root):
    """A local disk: network shares, card readers and optical drives are left alone (slow or asleep)."""
    try:
        import ctypes
        return ctypes.windll.kernel32.GetDriveTypeW(root) == 3        # DRIVE_FIXED
    except (AttributeError, OSError):                                 # not Windows
        return False


def find_client():
    """A game client folder (one holding Data/common.MPQ): the usual install folders, then, one and two levels
    under each drive's root, any folder that holds one. None when there is none."""
    roots = [drive + ":\\" for drive in string.ascii_uppercase[2:] if _fixed_drive(drive + ":\\")]
    bases = [os.environ.get(name) for name in ("ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA")]
    bases = [b for b in bases if b] + roots
    for base in bases:
        for place in CLIENT_PLACES:
            folder = os.path.join(base, *place.split("/"))
            if is_client(folder):
                return folder
    for root in roots:
        try:
            first = [os.path.join(root, name) for name in sorted(os.listdir(root))]
        except OSError:
            continue
        for folder in first:
            if not os.path.isdir(folder) or os.path.basename(folder).lower() in ("windows", "$recycle.bin"):
                continue
            if is_client(folder):
                return folder
            try:
                second = [os.path.join(folder, name) for name in sorted(os.listdir(folder))]
            except OSError:
                continue
            for inner in second:
                if is_client(inner):
                    return inner
    return None


class Icons:
    def __init__(self, folder, client_dir, dbc, web=True, search=True):
        """`client_dir` is the configured or nearby client (None if unknown); with `search`, the usual install
        folders are looked at once, in the background, when it is None."""
        self.folder, self.dbc, self.web = folder, dbc, bool(web)
        self.client_dir = client_dir if is_client(client_dir) else None
        self.lock = threading.Lock()
        self.client, self.known, self.extra = None, None, set()
        if self.client_dir is None and search:
            threading.Thread(target=self._search, daemon=True).start()

    def _search(self):
        found = find_client()
        if found and self.client_dir is None:
            self.client_dir = found

    @property
    def local(self):
        """Pictures can come from this PC: a client, or icons already extracted."""
        return bool(self.client_dir) or os.path.isdir(self.folder)

    @property
    def names(self):
        return self.dbc.has("ItemDisplayInfo")

    def name_for(self, display_id):
        """The icon's file name for an item look from ItemDisplayInfo.dbc, lower-cased, or ""."""
        return self.dbc.text("ItemDisplayInfo", int(display_id or 0), 5).lower()

    def remember(self, names):
        """Names read from world.itemdisplayinfo_dbc: they may be asked for too."""
        with self.lock:
            self.extra.update(n for n in names if NAME_RE.match(n))

    def _known(self, name):
        if self.known is None:
            table = self.dbc["ItemDisplayInfo"]
            self.known = {table.text(key, 5).lower() for key in table.rows} if table else set()
        return name in self.known or name in self.extra

    def png(self, name):
        """The PNG's bytes for an icon name, extracted from the client the first time. None if unknown."""
        name = (name or "").lower()
        if not NAME_RE.match(name):
            return None
        path = os.path.join(self.folder, name + ".png")
        if os.path.exists(path):
            with open(path, "rb") as handle:
                return handle.read()
        if not self.client_dir or not self._known(name):
            return None
        with self.lock:
            if not os.path.exists(path):
                if self.client is None:
                    try:
                        import wowart                 # tools/wowart.py
                        self.client = wowart.Client(self.client_dir)
                    except Exception:                 # noqa: BLE001  not a readable client: the web or the frame
                        self.client = False
                if not self.client:
                    return None
                try:
                    image = self.client.image("Interface\\Icons\\%s.blp" % name)
                    if image is None:
                        return None
                    os.makedirs(self.folder, exist_ok=True)
                    image.save_png(path)
                except Exception:                     # noqa: BLE001  an icon it cannot decode
                    return None
        with open(path, "rb") as handle:
            return handle.read()
