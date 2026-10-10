# Changelog

## 2.0 (for CoA Bots 2.0)

- **Armory** page on the dashboard: search any character, bot or player, by the start of its name and
  open its sheet (`#armory/Name`): gear in paper-doll order with quality colours, item level and
  tooltips (damage, stats, enchantment, gems), average item level, stats (saved by the server, or
  added up from the gear), professions and the latest achievements.
- Item icons taken from the game client on first use (`gameClient`, or a client beside the repack),
  kept in `icons/` (git-ignored, never published).
- Works without extras: without the server's DBC files (`dbcDir`) names fall back to numbers, without a
  client items keep their coloured frames, and with the database down the page says so.
- Read-only, through the dashboard's own mysql client; typed names are letters only, sent as hex
  literals. Dashboard only: the public copy and the LAN page leave the armory out.
