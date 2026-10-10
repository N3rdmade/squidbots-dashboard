"""The armory: find a character, bot or player, and open its sheet: gear, stats, professions, achievements.

Where each part comes from:

  search        characters.characters, by the start of the name. Bots are the characters of the RNDBOT<n>
                accounts (mod-playerbots); a bot shows its zone, a player never does.
  gear          characters.character_inventory: bag 0, slots 0 to 18 are what the character wears.
                Each row points to characters.item_instance (the copy of the item this character owns:
                its enchantments and random suffix), which points to world.item_template (the item
                itself: name, quality, item level, stats, armour, damage).
  enchantments  item_instance.enchantments is 36 numbers, 3 per enchantment slot (id, duration,
                charges). Slot 0 is the permanent enchantment, slots 2 to 4 the gems in the sockets.
                Their text is in SpellItemEnchantment.dbc.
  suffix        item_instance.randomPropertyId: positive, a row of ItemRandomProperties.dbc
                ("of the Bear"); negative, a row of ItemRandomSuffix.dbc.
  stats         characters.character_stats, which the server fills only when worldserver.conf asks it
                to (PlayerSave.Stats.MinLevel above 0). Without it, the sheet adds up the gear.
  professions   characters.character_skills, named and sorted by SkillLine.dbc (category 11 are the
                professions, 9 the secondary skills such as Cooking or Riding).
  achievements  characters.character_achievement, named from Achievement.dbc.

The database is read with the dashboard's own mysql client (squidbots.py's mysql()). What a visitor
types never goes into the SQL text as such: a name must be letters only, and it is sent as a hex
literal (X'...'), which no input can break out of. Numbers are formatted as integers.

Without the server's DBC files the sheet still opens: names fall back to numbers ("Achievement #6"),
the main professions keep their names from the table below, and the page says names are missing.
Icons (icons.py): the name from world.itemdisplayinfo_dbc or ItemDisplayInfo.dbc, the picture from a local
client, else from wow.zamimg.com in the browser ("webIcons": false turns that off), else the quality frame.
"""
import re

from .dbc import Tables
from .icons import Icons

RACES = {1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead", 6: "Tauren", 7: "Gnome",
         8: "Troll", 10: "Blood Elf", 11: "Draenei"}
ALLIANCE = {1, 3, 4, 7, 11}
BOT_ACCOUNTS = "RNDBOT%"          # mod-playerbots' random bots all live on RNDBOT<n> accounts
NAME_RE = re.compile(r"^[^\W\d_]{2,12}$")

SLOTS = ["Head", "Neck", "Shoulder", "Shirt", "Chest", "Waist", "Legs", "Feet", "Wrist", "Hands",
         "Finger", "Finger", "Trinket", "Trinket", "Back", "Main hand", "Off hand", "Ranged", "Tabard"]
NOT_IN_AVERAGE = {3, 18}          # the shirt and the tabard do not count in the average item level

# ItemModType: what the stat_type columns of item_template mean.
STAT_NAMES = {
    0: "Mana", 1: "Health", 3: "Agility", 4: "Strength", 5: "Intellect", 6: "Spirit", 7: "Stamina",
    12: "Defense rating", 13: "Dodge rating", 14: "Parry rating", 15: "Block rating",
    16: "Melee hit rating", 17: "Ranged hit rating", 18: "Spell hit rating",
    19: "Melee critical strike rating", 20: "Ranged critical strike rating", 21: "Spell critical strike rating",
    28: "Melee haste rating", 29: "Ranged haste rating", 30: "Spell haste rating",
    31: "Hit rating", 32: "Critical strike rating", 35: "Resilience rating", 36: "Haste rating",
    37: "Expertise rating", 38: "Attack power", 39: "Ranged attack power", 41: "Healing", 42: "Spell damage",
    43: "Mana per 5 sec.", 44: "Armor penetration rating", 45: "Spell power", 46: "Health per 5 sec.",
    47: "Spell penetration", 48: "Block value",
}
PRIMARY = (7, 4, 3, 5, 6)          # shown first, in the game's own order

# The professions (True) and secondary skills (False) of 3.3.5, for a server without SkillLine.dbc.
SKILLS = {171: ("Alchemy", True), 164: ("Blacksmithing", True), 333: ("Enchanting", True),
          202: ("Engineering", True), 182: ("Herbalism", True), 773: ("Inscription", True),
          755: ("Jewelcrafting", True), 165: ("Leatherworking", True), 186: ("Mining", True),
          393: ("Skinning", True), 197: ("Tailoring", True), 185: ("Cooking", False),
          129: ("First Aid", False), 356: ("Fishing", False), 762: ("Riding", False)}

ITEM_COLUMNS = ("it.name, it.Quality, it.ItemLevel, it.RequiredLevel, it.InventoryType, it.armor, "
                "it.dmg_min1, it.dmg_max1, it.delay, "
                + ", ".join("it.stat_type%d, it.stat_value%d" % (i, i) for i in range(1, 11)) + ", it.displayid")
CHARACTER_COLUMNS = ("c.name, c.race, c.class, c.gender, c.level, c.zone, "
                     "TRIM(IFNULL(s.data, '0')), g.name, c.online, c.totaltime, a.username LIKE ")


class NotFound(Exception):
    pass


class BadRequest(Exception):
    pass


def sql_value(value):
    """A value as SQL text: an integer as is, a string as a hex literal (nothing in it can end the literal)."""
    if isinstance(value, bool) or not isinstance(value, (int, str)):
        raise TypeError("only int and str go into a query")
    if isinstance(value, int):
        return str(int(value))
    # An introducer, not CONVERT(): the literal then takes the column's collation instead of clashing with it.
    return "_utf8mb4 X'%s'" % value.encode("utf-8").hex() if value else "''"


def build(sql, args=()):
    """`sql` with each %s replaced by its value from `args`, through sql_value()."""
    parts = sql.split("%s")
    if len(parts) != len(args) + 1:
        raise ValueError("%d placeholders for %d values" % (len(parts) - 1, len(args)))
    out = [parts[0]]
    for value, part in zip(args, parts[1:]):
        out += [sql_value(value), part]
    return "".join(out)


def _null(value):
    """mysql -B writes NULL for a missing value."""
    return None if value in (None, "NULL") else value


def _int(value):
    try:
        return int(float(_null(value) or 0))
    except ValueError:
        return 0


def _enchant_ids(text):
    numbers = [int(n) for n in (_null(text) or "").split() if n.lstrip("-").isdigit()]
    numbers += [0] * (36 - len(numbers))
    return numbers[0::3]          # one id per enchantment slot


class Armory:
    def __init__(self, query, databases, names, dbc_dir, icons_dir, client_dir, web_icons=True, search_client=True):
        """`query(sql)` returns rows of strings (squidbots.py's mysql()). `names()` returns
        (classes, specs, zones): the dashboard's own lookup tables."""
        self.query, self.names = query, names
        self.chars, self.auth, self.world = databases["characters"], databases["auth"], databases["world"]
        self.dbc = Tables(dbc_dir)
        self.icons = Icons(icons_dir, client_dir, self.dbc, web=web_icons, search=search_client)

    def rows(self, sql, args=()):
        return self.query(build(sql, args))

    def status(self):
        """What the page can show besides the database: names from the DBC files, where icons come from."""
        return {"names": self.dbc.has("SkillLine") and self.dbc.has("Achievement"),
                "icons": self._icon_sources()}

    def _icon_sources(self):
        return {"local": self.icons.local, "web": self.icons.web}

    def _icon_names(self, display_ids):
        """{display id: icon name}: world.itemdisplayinfo_dbc first (CoA's custom looks are there), then
        ItemDisplayInfo.dbc for the rest. A server without the table just uses the file."""
        names = {}
        ids = sorted({i for i in display_ids if i > 0})
        if ids:
            try:
                for display, icon in self.query("SELECT ID, InventoryIcon_1 FROM {w}.itemdisplayinfo_dbc WHERE ID IN ({ids})"
                                                .format(w=self.world, ids=", ".join(str(int(i)) for i in ids))):
                    icon = (_null(icon) or "").strip().lower()
                    if icon:
                        names[_int(display)] = icon
            except Exception:  # noqa: BLE001  no such table on this server
                pass
        self.icons.remember(names.values())
        for display in ids:
            if display not in names:
                icon = self.icons.name_for(display)
                if icon:
                    names[display] = icon
        return names

    def _joins(self):
        return ("FROM {c}.characters c JOIN {a}.account a ON a.id = c.account "
                "LEFT JOIN {c}.character_settings s ON s.guid = c.guid AND s.source = 'core.ascension_active_spec' "
                "LEFT JOIN {c}.guild_member gm ON gm.guid = c.guid "
                "LEFT JOIN {c}.guild g ON g.guildid = gm.guildid ").format(c=self.chars, a=self.auth)

    def _character(self, row):
        classes, specs, zones = self.names()
        name, race, cls, _gender, level, zone, spec, guild, online, played, is_bot = row[:11]
        race, cls, spec, is_bot = _int(race), _int(cls), _int(spec), _int(is_bot) == 1
        out = {"name": name, "race": RACES.get(race, "Race %s" % race), "class": classes.get(cls, str(cls)),
               "spec": specs.get("%d:%d" % (cls, spec), "") if spec else "", "level": _int(level),
               "faction": "alliance" if race in ALLIANCE else "horde", "guild": _null(guild) or "",
               "online": _int(online) == 1, "hours": round(_int(played) / 3600.0, 1), "bot": is_bot}
        if is_bot:
            out["zone"] = (zones or {}).get(_int(zone), "")
        return out

    def search(self, text):
        """Characters whose name starts with `text`, the exact name first."""
        text = (text or "").strip()
        if not NAME_RE.match(text):
            raise BadRequest("Type at least two letters of a character name.")
        rows = self.rows("SELECT " + CHARACTER_COLUMNS + "%s " + self._joins()
                         + "WHERE c.name LIKE %s ORDER BY c.name = %s DESC, c.level DESC LIMIT 25",
                         (BOT_ACCOUNTS, text + "%", text))
        return {"characters": [self._character(row) for row in rows]}

    def sheet(self, name):
        name = (name or "").strip()
        if not NAME_RE.match(name):
            raise BadRequest("A character name is letters only.")
        found = self.rows("SELECT c.guid, " + CHARACTER_COLUMNS + "%s " + self._joins() + "WHERE c.name = %s",
                          (BOT_ACCOUNTS, name))
        if not found:
            raise NotFound("No character by that name.")
        guid = _int(found[0][0])
        sheet = self._character(found[0][1:])
        dbc = self.dbc
        inventory = self.rows(
            "SELECT ci.slot, ii.itemEntry, ii.enchantments, ii.randomPropertyId, " + ITEM_COLUMNS + " "
            "FROM {c}.character_inventory ci JOIN {c}.item_instance ii ON ii.guid = ci.item "
            "LEFT JOIN {w}.item_template it ON it.entry = ii.itemEntry "
            "WHERE ci.guid = %s AND ci.bag = 0 AND ci.slot < 19 ORDER BY ci.slot"
            .format(c=self.chars, w=self.world), (guid,))
        icon_names = self._icon_names(_int(row[4 + 29]) for row in inventory)

        # ---- gear
        gear, levels, totals, armour = [], [], {}, 0
        for row in inventory:
            slot, entry, enchantments, random_id = _int(row[0]), _int(row[1]), row[2], _int(row[3])
            item = row[4:]
            item_name = _null(item[0])
            quality, item_level, required, item_armour = (_int(v) for v in (item[1], item[2], item[3], item[5]))
            dmg_min, dmg_max, delay = _int(item[6]), _int(item[7]), _int(item[8])
            stats = []
            for i in range(10):
                kind, value = _int(item[9 + 2 * i]), _int(item[10 + 2 * i])
                if value:
                    stats.append({"name": STAT_NAMES.get(kind, "Stat %d" % kind), "value": value})
                    totals[kind] = totals.get(kind, 0) + value
            armour += item_armour
            suffix = (dbc.text("ItemRandomProperties", random_id, 7) if random_id > 0
                      else dbc.text("ItemRandomSuffix", -random_id, 1) if random_id < 0 else "")
            enchant_ids = _enchant_ids(enchantments)
            piece = {
                "slot": slot, "slotName": SLOTS[slot] if slot < len(SLOTS) else str(slot), "entry": entry,
                "name": (item_name or "Item %d" % entry) + (" " + suffix if suffix else ""),
                "quality": quality, "itemLevel": item_level, "requiredLevel": required,
                "armor": item_armour, "stats": stats,
                "enchant": (dbc.text("SpellItemEnchantment", enchant_ids[0], 14) or "Enchantment #%d" % enchant_ids[0])
                if enchant_ids[0] else "",
                "gems": [dbc.text("SpellItemEnchantment", g, 14) or "Gem" for g in enchant_ids[2:5] if g],
                # The icon's file name for the item's look; the page asks icons/<name>.png, then the web.
                "icon": icon_names.get(_int(item[29]), ""),
            }
            if dmg_max:
                piece["damage"] = [dmg_min, dmg_max]
                piece["speed"] = round(delay / 1000.0, 2)
            gear.append(piece)
            if slot not in NOT_IN_AVERAGE and item_level:
                levels.append(item_level)
        sheet["gear"] = gear
        sheet["itemLevel"] = round(sum(levels) / len(levels)) if levels else 0

        # ---- stats: saved by the server if it is told to, otherwise added up from the gear
        saved = self.rows("SELECT maxhealth, strength, agility, stamina, intellect, spirit, armor, attackPower, "
                          "spellPower, critPct, dodgePct, parryPct, blockPct, resilience "
                          "FROM {c}.character_stats WHERE guid = %s".format(c=self.chars), (guid,))
        if saved:
            keys = ("Health", "Strength", "Agility", "Stamina", "Intellect", "Spirit", "Armor", "Attack power",
                    "Spell power", "Critical strike %", "Dodge %", "Parry %", "Block %", "Resilience")
            values = []
            for key, value in zip(keys, saved[0]):
                number = float(_null(value) or 0)
                if number:
                    values.append({"name": key, "value": round(number, 2) if "%" in key else int(number)})
            sheet["stats"] = {"source": "saved", "values": values}
        else:
            order = list(PRIMARY) + sorted(k for k in totals if k not in PRIMARY)
            values = [{"name": "Armor", "value": armour}] if armour else []
            values += [{"name": STAT_NAMES.get(k, "Stat %d" % k), "value": totals[k]} for k in order if totals.get(k)]
            sheet["stats"] = {"source": "gear", "values": values}

        # ---- professions and secondary skills
        skills, with_skill_names = [], dbc.has("SkillLine")
        for skill, value, maximum in self.rows("SELECT skill, value, max FROM {c}.character_skills WHERE guid = %s"
                                               .format(c=self.chars), (guid,)):
            skill = _int(skill)
            if with_skill_names:
                category, skill_name = dbc.get("SkillLine", skill, 1), dbc.text("SkillLine", skill, 3)
                if category not in (9, 11) or skill_name.startswith("Racial"):
                    continue
                profession = category == 11
            elif skill in SKILLS:
                skill_name, profession = SKILLS[skill]
            else:
                continue
            skills.append({"name": skill_name or "Skill %d" % skill, "value": _int(value), "max": _int(maximum),
                           "profession": profession})
        skills.sort(key=lambda s: (not s["profession"], s["name"]))
        sheet["skills"] = skills

        # ---- achievements
        earned = self.rows("SELECT achievement, date FROM {c}.character_achievement WHERE guid = %s "
                           "ORDER BY date DESC".format(c=self.chars), (guid,))
        with_achievements = dbc.has("Achievement")
        sheet["achievements"] = {
            "count": len(earned),
            # Points live in Achievement.dbc only: without it they are unknown, not zero.
            "points": sum(dbc.get("Achievement", _int(a), 39) for a, _ in earned) if with_achievements else None,
            "latest": [{"id": _int(a), "name": dbc.text("Achievement", _int(a), 4) or "Achievement #%d" % _int(a),
                        "at": _int(d)} for a, d in earned[:8]],
        }
        sheet["names"] = with_skill_names and with_achievements
        sheet["icons"] = self._icon_sources()
        return sheet
