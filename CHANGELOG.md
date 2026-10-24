# Changelog

## 2.8 (for CoA Bots 2.8)

- **Every realm of the server.** Beside the CoA realm, the Wildcard (Darkmoon) and Warcraft Reborn (Bronzebeard)
  realms the launcher adds are found on their own (`Royaumes\<key>`, read only): a realm picker in the side bar,
  each page on the realm picked (`?realm=wildcard` opens it), its own databases, journals, live map and PvP. A new
  **Realms** page shows them side by side: online or not, bots and players online, average level, tick, memory,
  crashes and the bots of the last hours. A server without extra realms looks exactly as before.
- Fixed for the extra realms: their bots (`RNDWC…`, `RNDWR…` accounts) counted as players; "online" and the
  memory followed any worldserver.exe (all realms run the same one); the server hours added up every realm's
  uptime; the Settings page wrote files the launcher builds again at every start. Settings of a realm now go to
  its `settings.json`, the launcher's own layer, and the values its game mode sets are shown greyed.
- **Server health** page: tick (the world's update time), players, bots, memory, processor and crashes now, curves
  over 24 hours and 7 days, the realm's starts, stops and crash reports, and plain advice when something is off.
  Measured once a minute at almost no cost: the process figures come from Windows directly, one `server info` on
  the realm's console, never the database (`monitorEvery`, 0 turns it off).
- **Auction house** page: auctions by house, by seller (auction house bot, random bots, players), by quality and by
  kind of item, the most expensive ones, the week's curve, and the auction house bot's own commands (run a cycle,
  reload its settings, empty its auctions).
- **Game master** page, on this PC only: a message to every player (chat or screen), save every character, and for a
  player of the list kick, revive, unstuck, mute, set the level, send gold or an item, ban or unban the account,
  set its GM level. Each action is the server's own console command (the repack's console account), checked
  first and kept in `data\gm-actions.jsonl`. `"gmTools": false` in dashboard.json removes it.
- Lighter: a tab in the background asks nothing, the names shared by every realm are read once, and the public copy
  and the local network page carry every realm (`realms.json`, `stats-<key>.json`; `publicRealms` limits them).

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
