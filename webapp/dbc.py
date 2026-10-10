"""Reading the server's DBC files: the game's own lookup tables, shipped with every server in data/dbc.

A 3.3.5 DBC file is simple: a 20-byte header (the letters "WDBC", then the number of records, the
number of fields, the size of a record and the size of the string block), the records one after the
other, each field 4 bytes, then a block of text. A text field holds the offset of its string in that
block. Names come in 16 languages plus a flags field; the English name is the first of them.

The armory reads a handful of them to turn numbers into names:

  SkillLine.dbc               field 1 = category (11 professions, 9 secondary skills), 3 = English name
  Achievement.dbc             4 = title, 38 = category, 39 = points
  ItemRandomProperties.dbc    7 = the suffix ("of the Bear") of an item with a positive random id
  ItemRandomSuffix.dbc        1 = the suffix of an item with a negative random id
  SpellItemEnchantment.dbc    14 = what an enchantment or a gem gives ("+8 Agility")
  ItemDisplayInfo.dbc         5 = an item look's icon file name (see icons.py)

A missing or unreadable file is not an error: its numbers stay numbers and the armory says so.
"""
import os
import re
import struct
import threading

COLOUR_CODES = re.compile(r"\|c[0-9a-fA-F]{8}|\|r")


class Dbc:
    def __init__(self, path):
        raw = open(path, "rb").read()
        magic, count, fields, size, _ = struct.unpack("<4s4I", raw[:20])
        if magic != b"WDBC":
            raise ValueError("%s is not a DBC file" % path)
        self.fields, self.strings = fields, raw[20 + count * size:]
        self.rows = {}
        for i in range(count):
            row = struct.unpack_from("<%dI" % fields, raw, 20 + i * size)
            self.rows[row[0]] = row

    def get(self, key, field, default=0):
        row = self.rows.get(key)
        return row[field] if row and field < self.fields else default

    def text(self, key, field):
        offset = self.get(key, field)
        if not offset or offset >= len(self.strings):
            return ""
        end = self.strings.index(b"\0", offset)
        return COLOUR_CODES.sub("", self.strings[offset:end].decode("utf-8", "replace")).strip()


class Tables:
    """The DBC files the armory needs, each read once, the first time it is asked for."""

    def __init__(self, folder):
        self.folder, self.loaded, self.lock = folder, {}, threading.Lock()

    def __getitem__(self, name):
        with self.lock:
            if name not in self.loaded:
                path = os.path.join(self.folder or "", name + ".dbc")
                try:
                    self.loaded[name] = Dbc(path)
                except (OSError, ValueError, struct.error):
                    self.loaded[name] = None        # missing file: numbers stay numbers
            return self.loaded[name]

    def text(self, name, key, field):
        table = self[name]
        return table.text(key, field) if table else ""

    def get(self, name, key, field, default=0):
        table = self[name]
        return table.get(key, field, default) if table else default

    def has(self, name):
        """True when that DBC file could be read."""
        return self[name] is not None
