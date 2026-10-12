# Changelog

## 2.1 (for CoA Bots 2.1)

- **Turn the journals on** writes the repack's `Settings\worldserver.conf.template`: the repack rebuilds both
  `worldserver.conf` files from it at every start, and the button looked for it in the wrong folder, so
  `Battleground.StoreStatistics.Enable` (battlegrounds on the PvP page) went back to 0 (also shipped as 2.0.1).
- When the database is down, the Armory and the other pages say so ("The database is not answering: is MySQL
  running?") instead of showing mysql.exe's warning about a password on the command line.

## 2.0 (for CoA Bots 2.0)

- **Armory** page on the dashboard: search any character, bot or player, by the start of its name and
  open its sheet (`#armory/Name`): gear in paper-doll order with quality colours, item level and
  tooltips (damage, stats, enchantment, gems), average item level, stats (saved by the server, or
  added up from the gear), professions and the latest achievements.
- Item icons: the name from `world.itemdisplayinfo_dbc` (CoA's own looks) or `ItemDisplayInfo.dbc`,
  the picture from a game client on this PC (`gameClient`, or one found beside the repack or in a usual
  folder; kept in `icons/`, never published), else from wow.zamimg.com in the browser (`"webIcons": false`
  turns that off), else the quality frame.
- Shown in the CoA Server Manager's Dashboard tab too (it displays the dashboard's own page).
- Works without extras: without the server's DBC files (`dbcDir`) names fall back to numbers, without a
  client items keep their coloured frames, and with the database down the page says so.
- Read-only, through the dashboard's own mysql client; typed names are letters (one space at most), sent as hex
  literals. The public copy and the LAN page leave the armory out.
