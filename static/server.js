/* The pages of the server's owner, on this PC only (never in the public copy): the health of the realm's
   worldserver, its auction house, and the game master tools. Each page reads the realm chosen in the side bar.
   Reads /api/perf, /api/market and /api/gm (squidbots.py), which add ?realm= through dashboard.js. */

const SERVER_WORDS = {
  en: {
    srvTick: "Server tick", srvTickFoot: "mean of the last updates", srvPlayers: "Players online",
    srvBots: "Bots online", srvRam: "Memory", srvRamFoot: m => "peak today " + m, srvCpu: "Processor",
    srvCpuFoot: (core, machine) => core + " of one core · " + machine + " of the PC", srvCrashes: "Crashes, 24 h",
    srvCrashesFoot: last => (last ? "last " + last : "none"), srvUptime: "Up for", srvStopped: "This realm's worldserver is not running.",
    srvStarting: "The worldserver is starting: the world opens in a moment.",
    srvConsoleOff: "The world console does not answer: tick and players are unknown. ",
    srvHealth: "Health", srvCharts: "Over time", srvDay: "24 hours", srvWeek: "7 days", srvEvents: "Events",
    srvNoEvents: "Nothing yet: starts, stops and crash reports appear here.", srvEventKinds: { start: "Started", stop: "Stopped", crash: "Crash report", down: "Went down on its own (crash)" },
    srvChartTick: "Tick (ms)", srvChartBots: "Bots online", srvChartPlayers: "Players online", srvChartRam: "Memory (MB)", srvChartCpu: "Processor (% of one core)",
    srvWaiting: "The first points arrive within a minute; the curves fill as the realm runs.",
    srvSampling: s => "measured every " + s + " s, without asking the database",
    srvOff: "Measuring is off (monitorEvery = 0 in dashboard.json): only the state of the moment is shown.",
    hintGood: "All good: the world updates smoothly.",
    hintTick: t => "The world takes " + t + " ms per update: the game feels sluggish above 150 ms. Fewer bots (Bot settings) or a realm stopped helps.",
    hintTickWarn: t => "The tick is " + t + " ms: playable, but the server is busy.",
    hintRam: (gb, gain) => "Memory went from " + gb + " up by " + gain + " in a day: watch it, a restart frees it.",
    hintCrash: n => n + " crash report(s) in 24 h: the files are in the Crashes folder of the realm.",
    hintStale: "The bots' live status file is not written: the map and the live figures stay empty.",
    mkAuctions: "Auctions", mkValue: "Buyout value", mkBuyout: "With a buyout", mkBids: "With bids", mkSoon: "Ending within 1 h",
    mkBot: "Auction house bot", mkHouses: "By auction house", mkSellers: "By seller", mkQualities: "By quality",
    mkClasses: "By kind of item", mkTop: "The most expensive", mkHistory: "Auctions over the week", mkEmpty: "No auction right now.",
    mkHouse: { alliance: "Alliance", horde: "Horde", neutral: "Neutral" },
    mkSeller: { ahbot: "Auction house bot", bots: "Random bots", players: "Players", gone: "Deleted characters" },
    mkQuality: ["Poor", "Common", "Uncommon", "Rare", "Epic", "Legendary", "Artifact", "Heirloom"],
    mkClass: ["Consumable", "Container", "Weapon", "Gem", "Armor", "Reagent", "Projectile", "Trade goods", "Generic",
      "Recipe", "Money", "Quiver", "Quest", "Key", "Permanent", "Miscellaneous", "Glyph"],
    mkItem: "Item", mkCount: "Qty", mkPrice: "Buyout", mkBid: "Bid", mkLeft: "Left", mkFrom: "Seller",
    mkBotActions: "Auction house bot", mkBotHelp: "A sale cycle now, the settings of mod_ahbot.conf read again, or every auction of the bot taken down.",
    mkUpdate: "Run a cycle", mkReload: "Reload settings", mkEmptyAh: "Empty its auctions",
    mkEmptyConfirm: "Take down every auction of the auction house bot on this realm?",
    gmConsole: "World console", gmOn: p => "connected · port " + p, gmOffline: "the realm is not running: actions need it online",
    gmMessage: "Message to every player", gmAnnounce: "Announce in chat", gmNotify: "Notify on screen", gmSave: "Save every character",
    gmMessageHelp: "Sent as the server, to everyone online on this realm.",
    gmPlayers: "Players", gmPlayersHelp: "Characters of real accounts on this realm (bots and the auction house bot left out), online first.",
    gmFilter: "Filter by name or account", gmNone: "No player character on this realm yet.",
    gmName: "Character", gmLevel: "Level", gmAccount: "Account", gmLastSeen: "Last seen", gmNow: "online",
    gmPick: "Pick a player in the list to act on them.", gmActions: "Actions on ",
    gmKick: "Kick", gmRevive: "Revive", gmUnstuck: "Unstuck", gmInn: "to the inn", gmGraveyard: "to the graveyard", gmStart: "to the start zone",
    gmMute: "Mute", gmUnmute: "Unmute", gmMinutes: "minutes", gmReason: "reason", gmSetLevel: "Set level",
    gmGold: "Send gold", gmItem: "Send an item", gmItemId: "item number", gmCount: "count",
    gmBan: "Ban the account", gmDuration: "30m, 12h, 7d, -1 = for ever", gmUnban: "Unban", gmGmLevel: "GM level",
    gmGmLevels: ["Player", "Moderator", "Game master", "Administrator"],
    gmJournal: "Journal", gmJournalEmpty: "No action yet on this realm.", gmDone: "Done", gmFailed: "Refused",
    gmConfirm: (what, who) => what + " — " + who + "?", gmBanned: "banned", gmMuted: "muted", gmSent: "Sent: ",
    gmOffTools: "The GM tools are turned off in dashboard.json (gmTools).",
  },
  fr: {
    srvTick: "Tick serveur", srvTickFoot: "moyenne des dernières mises à jour", srvPlayers: "Joueurs en ligne",
    srvBots: "Bots en ligne", srvRam: "Mémoire", srvRamFoot: m => "pic du jour " + m, srvCpu: "Processeur",
    srvCpuFoot: (core, machine) => core + " d'un cœur · " + machine + " du PC", srvCrashes: "Plantages, 24 h",
    srvCrashesFoot: last => (last ? "dernier " + last : "aucun"), srvUptime: "En ligne depuis", srvStopped: "Le worldserver de ce royaume est arrêté.",
    srvStarting: "Le worldserver démarre : le monde ouvre dans un instant.",
    srvConsoleOff: "La console du monde ne répond pas : tick et joueurs inconnus. ",
    srvHealth: "Santé", srvCharts: "Dans le temps", srvDay: "24 heures", srvWeek: "7 jours", srvEvents: "Événements",
    srvNoEvents: "Rien pour l'instant : démarrages, arrêts et rapports de plantage s'affichent ici.", srvEventKinds: { start: "Démarré", stop: "Arrêté", crash: "Rapport de plantage", down: "Tombé tout seul (plantage)" },
    srvChartTick: "Tick (ms)", srvChartBots: "Bots en ligne", srvChartPlayers: "Joueurs en ligne", srvChartRam: "Mémoire (Mo)", srvChartCpu: "Processeur (% d'un cœur)",
    srvWaiting: "Les premiers points arrivent dans la minute ; les courbes se remplissent pendant que le royaume tourne.",
    srvSampling: s => "mesuré toutes les " + s + " s, sans interroger la base",
    srvOff: "La mesure est coupée (monitorEvery = 0 dans dashboard.json) : seul l'état du moment s'affiche.",
    hintGood: "Tout va bien : le monde se met à jour sans à-coups.",
    hintTick: t => "Le monde met " + t + " ms par mise à jour : le jeu rame au-delà de 150 ms. Moins de bots (Réglages) ou un royaume arrêté aide.",
    hintTickWarn: t => "Le tick est de " + t + " ms : jouable, mais le serveur est chargé.",
    hintRam: (gb, gain) => "La mémoire est passée de " + gb + " à +" + gain + " en un jour : à surveiller, un redémarrage la libère.",
    hintCrash: n => n + " rapport(s) de plantage en 24 h : les fichiers sont dans le dossier Crashes du royaume.",
    hintStale: "Le fichier d'état des bots n'est pas écrit : la carte et les chiffres en direct restent vides.",
    mkAuctions: "Enchères", mkValue: "Valeur en achat immédiat", mkBuyout: "Avec achat immédiat", mkBids: "Avec offres", mkSoon: "Finissent dans l'heure",
    mkBot: "Bot de l'hôtel des ventes", mkHouses: "Par hôtel des ventes", mkSellers: "Par vendeur", mkQualities: "Par qualité",
    mkClasses: "Par type d'objet", mkTop: "Les plus chères", mkHistory: "Enchères sur la semaine", mkEmpty: "Aucune enchère en ce moment.",
    mkHouse: { alliance: "Alliance", horde: "Horde", neutral: "Neutre" },
    mkSeller: { ahbot: "Bot de l'HdV", bots: "Bots aléatoires", players: "Joueurs", gone: "Personnages supprimés" },
    mkQuality: ["Médiocre", "Commun", "Inhabituel", "Rare", "Épique", "Légendaire", "Artefact", "Héritage"],
    mkClass: ["Consommable", "Sac", "Arme", "Gemme", "Armure", "Composant", "Projectile", "Artisanat", "Générique",
      "Recette", "Monnaie", "Carquois", "Quête", "Clé", "Permanent", "Divers", "Glyphe"],
    mkItem: "Objet", mkCount: "Qté", mkPrice: "Achat immédiat", mkBid: "Offre", mkLeft: "Reste", mkFrom: "Vendeur",
    mkBotActions: "Bot de l'hôtel des ventes", mkBotHelp: "Un cycle de ventes tout de suite, les réglages de mod_ahbot.conf relus, ou toutes les enchères du bot retirées.",
    mkUpdate: "Lancer un cycle", mkReload: "Relire les réglages", mkEmptyAh: "Vider ses enchères",
    mkEmptyConfirm: "Retirer toutes les enchères du bot de l'hôtel des ventes sur ce royaume ?",
    gmConsole: "Console du monde", gmOn: p => "connectée · port " + p, gmOffline: "le royaume est arrêté : les actions demandent qu'il tourne",
    gmMessage: "Message à tous les joueurs", gmAnnounce: "Annonce dans le chat", gmNotify: "Notification à l'écran", gmSave: "Sauvegarder tous les personnages",
    gmMessageHelp: "Envoyé au nom du serveur, à tous les joueurs en ligne sur ce royaume.",
    gmPlayers: "Joueurs", gmPlayersHelp: "Personnages des vrais comptes de ce royaume (bots et bot de l'HdV exclus), en ligne d'abord.",
    gmFilter: "Filtrer par nom ou compte", gmNone: "Aucun personnage joueur sur ce royaume pour l'instant.",
    gmName: "Personnage", gmLevel: "Niveau", gmAccount: "Compte", gmLastSeen: "Vu", gmNow: "en ligne",
    gmPick: "Choisissez un joueur dans la liste pour agir sur lui.", gmActions: "Actions sur ",
    gmKick: "Expulser", gmRevive: "Ressusciter", gmUnstuck: "Débloquer", gmInn: "à l'auberge", gmGraveyard: "au cimetière", gmStart: "en zone de départ",
    gmMute: "Rendre muet", gmUnmute: "Rendre la parole", gmMinutes: "minutes", gmReason: "raison", gmSetLevel: "Fixer le niveau",
    gmGold: "Envoyer de l'or", gmItem: "Envoyer un objet", gmItemId: "numéro d'objet", gmCount: "nombre",
    gmBan: "Bannir le compte", gmDuration: "30m, 12h, 7d, -1 = définitif", gmUnban: "Débannir", gmGmLevel: "Niveau MJ",
    gmGmLevels: ["Joueur", "Modérateur", "Maître de jeu", "Administrateur"],
    gmJournal: "Journal", gmJournalEmpty: "Aucune action sur ce royaume pour l'instant.", gmDone: "Fait", gmFailed: "Refusé",
    gmConfirm: (what, who) => what + " — " + who + " ?", gmBanned: "banni", gmMuted: "muet", gmSent: "Envoyé : ",
    gmOffTools: "Les outils MJ sont coupés dans dashboard.json (gmTools).",
  },
};
const SW = () => SERVER_WORDS[lang] || SERVER_WORDS.en;
const gb = gigabytes;
const ago = ts => {
  const minutes = Math.max(0, Math.round((Date.now() / 1000 - ts) / 60));
  if (minutes < 60) return minutes + " min";
  if (minutes < 48 * 60) return Math.round(minutes / 60) + " h";
  return Math.round(minutes / 1440) + (lang === "fr" ? " j" : " d");
};
const coins = copper => {
  const g = Math.floor(copper / 10000), s = Math.floor(copper / 100) % 100, c = copper % 100;
  return (g ? '<span class="coin g">' + num(g) + "</span>" : "") + (s || g ? '<span class="coin s">' + s + "</span>" : "") +
    (!g ? '<span class="coin c">' + c + "</span>" : "");
};
const QUALITY_COLORS = ["#9d9d9d", "#eee2c6", "#1eff00", "#3b8cff", "#b36df2", "#ff8a1e", "#e6cc80", "#00ccff"];
const RACES = { 1: "Human", 2: "Orc", 3: "Dwarf", 4: "Night Elf", 5: "Undead", 6: "Tauren", 7: "Gnome", 8: "Troll",
  10: "Blood Elf", 11: "Draenei" };

async function getJson(url) {
  const answer = await fetch(url, { cache: "no-store" });
  const data = await answer.json();
  if (!answer.ok && !data.error) data.error = "HTTP " + answer.status;
  return data;
}

/* ------------------------------------------------------------- server health ---- */
let PERF = null, PERF_SPAN = "day", perfTimer = null;

async function loadPerf() {
  PERF = await getJson("/api/perf?span=" + PERF_SPAN).catch(error => ({ error: String(error) }));
  renderPerf();
}

function perfHints(state, points, crashes) {
  const words = SW(), hints = [];
  const tick = state.tickMean != null ? state.tickMean : state.tick;
  if (tick != null && tick >= 150) hints.push(["bad", words.hintTick(num(tick))]);
  else if (tick != null && tick >= 100) hints.push(["warn", words.hintTickWarn(num(tick))]);
  const rams = points.filter(p => p.ram != null);
  if (PERF_SPAN === "day" && rams.length > 120) {
    const first = rams.slice(0, 30).reduce((a, p) => a + p.ram, 0) / 30, last = rams.slice(-30).reduce((a, p) => a + p.ram, 0) / 30;
    if (last - first > 1024 && last > first * 1.3) hints.push(["warn", words.hintRam(gb(first), gb(last - first))]);
  }
  if (crashes && crashes.crashes24h) hints.push(["bad", words.hintCrash(crashes.crashes24h)]);
  if (state.running && state.bots == null && LIVE && LIVE.missing) hints.push(["warn", words.hintStale]);
  if (state.running && !hints.length) hints.push(["good", words.hintGood]);
  return hints;
}

function renderPerf() {
  const host = document.getElementById("serverPage");
  if (!host || !PERF) return;
  const words = SW();
  if (PERF.error) { host.innerHTML = '<div class="banner">' + esc(PERF.error) + "</div>"; return; }
  const state = PERF.state || {}, points = PERF.points || [], crashes = PERF.crashes || {};
  const tick = state.tickMean != null ? state.tickMean : state.tick;
  const peak = Math.max.apply(null, points.map(p => p.ramMax || p.ram || 0).concat([0]));
  const cpu = state.cpu;
  const tiles = [
    [words.srvTick, tick == null ? "–" : num(tick) + " ms", words.srvTickFoot, tickClass(tick)],
    [words.srvPlayers, state.players == null ? "–" : num(state.players), state.characters != null ? num(state.characters) + (lang === "fr" ? " personnages dans le monde" : " characters in world") : ""],
    [words.srvBots, state.bots == null ? "–" : num(state.bots), ""],
    [words.srvRam, state.ramMo == null ? "–" : gb(state.ramMo), peak ? words.srvRamFoot(gb(peak)) : ""],
    [words.srvCpu, cpu == null ? "–" : one(cpu / (PERF.cores || 1)) + " %", cpu == null ? "" : words.srvCpuFoot(one(cpu) + " %", one(cpu / (PERF.cores || 1)) + " %")],
    [words.srvCrashes, num(crashes.crashes24h || 0), words.srvCrashesFoot(crashes.lastCrash), crashes.crashes24h ? "bad" : ""],
  ];
  const status = state.running ? "running" : state.starting ? "starting" : state.disabled ? "disabled" : "stopped";
  const banner = !state.running ? '<div class="banner">' + esc(state.starting ? words.srvStarting : words.srvStopped) + "</div>"
    : state.ra === false ? '<div class="banner">' + esc(words.srvConsoleOff + (state.raError || "")) + "</div>" : "";
  const hints = perfHints(state, points, crashes).map(h => '<li class="hint ' + h[0] + '">' + esc(h[1]) + "</li>").join("");
  const events = (PERF.events || []).slice().reverse().slice(0, 14).map(e =>
    '<li class="event ' + esc(e.kind) + '"><span class="when num">' + esc(when(e.ts)) + "</span>" +
    esc(words.srvEventKinds[e.kind] || e.kind) + (e.text ? ' <span class="meta">' + esc(e.text) + "</span>" : "") + "</li>").join("");
  host.innerHTML = banner +
    '<section class="card server-head mode-' + esc((PERF.realm || {}).mode || REALM) + '"><span class="gem big" aria-hidden="true"></span>' +
      "<div><h2>" + esc((PERF.realm || {}).name || "") + ' <span class="state-badge ' + status + '">' + esc(W.realmState[status]) + "</span></h2>" +
      '<div class="meta">' + (state.uptime ? esc(words.srvUptime + " " + state.uptime) + " · " : "") +
      (PERF.every ? esc(words.srvSampling(PERF.every)) : esc(words.srvOff)) + (state.pid ? " · pid " + state.pid : "") + "</div></div></section>" +
    '<div class="figures">' + tiles.map(t => '<div class="figure ' + (t[3] || "") + '"><div class="label">' + esc(t[0]) +
      '</div><div class="value num">' + esc(t[1]) + '</div><div class="foot">' + esc(t[2]) + "</div></div>").join("") + "</div>" +
    '<div class="grid wide"><section class="card"><h2>' + esc(words.srvCharts) + ' <span class="sub"></span></h2>' +
      '<div class="tabs" role="tablist" id="perfSpan"><button type="button" data-span="day" aria-selected="' + (PERF_SPAN === "day") + '">' + esc(words.srvDay) +
      '</button><button type="button" data-span="week" aria-selected="' + (PERF_SPAN === "week") + '">' + esc(words.srvWeek) + "</button></div>" +
      '<div class="perf-charts">' + ["tick", "bots", "ram", "cpu"].map(k => '<div><h3 class="chart-title" id="perfTitle-' + k + '"></h3><div class="chart" id="perf-' + k + '"></div></div>').join("") + "</div></section>" +
    '<div><section class="card"><h2>' + esc(words.srvHealth) + '</h2><ul class="hints">' + hints + "</ul></section>" +
      '<section class="card"><h2>' + esc(words.srvEvents) + '</h2><ul class="events">' + (events || '<li class="empty">' + esc(words.srvNoEvents) + "</li>") + "</ul></section></div></div>";
  const charts = [["tick", words.srvChartTick, p => p.tick, "var(--gold)"], ["bots", words.srvChartBots, p => p.bots, "var(--realm)"],
    ["ram", words.srvChartRam, p => p.ram, "var(--accent)"], ["cpu", words.srvChartCpu, p => p.cpu, "var(--horde)"]];
  for (const [key, title, value, color] of charts) {
    document.getElementById("perfTitle-" + key).textContent = title;
    const shown = points.filter(p => value(p) != null).map(p => ({ ts: p.ts, v: value(p) }));
    const target = document.getElementById("perf-" + key);
    if (shown.length < 2) { target.innerHTML = '<p class="empty">' + esc(words.srvWaiting) + "</p>"; continue; }
    lineChart(target, shown, { value: p => p.v, label: title, unit: "", color: color });
  }
}

document.addEventListener("click", event => {
  const span = event.target.closest("#perfSpan button[data-span]");
  if (span) { PERF_SPAN = span.dataset.span; loadPerf(); }
});

/* ------------------------------------------------------------- auction house ---- */
let MARKET = null;
async function loadMarket() {
  MARKET = await getJson("/api/market").catch(error => ({ error: String(error) }));
  renderMarket();
}

function renderMarket() {
  const host = document.getElementById("marketPage");
  if (!host || !MARKET) return;
  const words = SW();
  if (MARKET.error && !MARKET.totals) { host.innerHTML = '<div class="banner">' + esc(MARKET.error) + "</div>"; return; }
  const t = MARKET.totals || {};
  const bot = (MARKET.sellers || []).find(s => s.key === "ahbot");
  const tiles = [[words.mkAuctions, num(t.auctions), num(t.items) + (lang === "fr" ? " objets" : " items")],
    [words.mkValue, null, coins(t.value || 0)], [words.mkBuyout, num(t.withBuyout), ""], [words.mkBids, num(t.withBids), ""],
    [words.mkSoon, num(t.endingSoon), ""], [words.mkBot, bot ? Math.round(bot.auctions / Math.max(1, t.auctions) * 100) + " %" : "0 %", bot ? num(bot.auctions) : ""]];
  const top = (MARKET.top || []).map(a => "<tr><td><span style=\"color:" + QUALITY_COLORS[a.quality] + '">[' + esc(a.name) + "]</span>" +
    (a.ilvl ? ' <span class="meta">ilvl ' + a.ilvl + "</span>" : "") + '</td><td class="r">' + a.count + '</td><td class="r">' + coins(a.buyout) +
    '</td><td class="r">' + (a.bid ? coins(a.bid) : "–") + '</td><td class="r">' + esc(ago(Date.now() / 1000 - a.left)) +
    "</td><td>" + esc(words.mkHouse[a.house] || a.house) + '</td><td class="meta">' + esc(words.mkSeller[a.seller] || a.seller) + "</td></tr>").join("");
  host.innerHTML = (MARKET.error ? '<div class="banner">' + esc(MARKET.error) + "</div>" : "") +
    '<div class="figures">' + tiles.map(f => '<div class="figure"><div class="label">' + esc(f[0]) + '</div><div class="value num">' +
      (f[1] === null ? f[2] : esc(f[1])) + '</div><div class="foot">' + (f[1] === null ? "" : esc(f[2])) + "</div></div>").join("") + "</div>" +
    '<div class="grid two"><section class="card"><h2>' + esc(words.mkHouses) + '</h2><div class="splits" id="mkHouses"></div>' +
      '<h2 class="later">' + esc(words.mkSellers) + '</h2><div class="splits" id="mkSellers"></div>' +
      '<h2 class="later">' + esc(words.mkQualities) + '</h2><div class="splits" id="mkQualities"></div></section>' +
    '<section class="card"><h2>' + esc(words.mkClasses) + '</h2><div id="mkClasses"></div></section></div>' +
    '<section class="card"><h2>' + esc(words.mkTop) + "</h2>" + (top ? '<div class="scroll"><table><thead><tr><th>' + esc(words.mkItem) +
      '</th><th class="r">' + esc(words.mkCount) + '</th><th class="r">' + esc(words.mkPrice) + '</th><th class="r">' + esc(words.mkBid) +
      '</th><th class="r">' + esc(words.mkLeft) + "</th><th>HdV</th><th>" + esc(words.mkFrom) + "</th></tr></thead><tbody>" + top + "</tbody></table></div>"
      : '<p class="empty">' + esc(words.mkEmpty) + "</p>") + "</section>" +
    '<div class="grid wide"><section class="card"><h2>' + esc(words.mkHistory) + '</h2><div class="chart" id="mkHistory"></div></section>' +
    '<section class="card"><h2>' + esc(words.mkBotActions) + '</h2><p class="meta">' + esc(words.mkBotHelp) + '</p><div class="gm-buttons">' +
      '<button class="btn" type="button" data-ahbot="update">' + esc(words.mkUpdate) + '</button><button class="btn" type="button" data-ahbot="reload">' +
      esc(words.mkReload) + '</button><button class="btn" type="button" data-ahbot="empty">' + esc(words.mkEmptyAh) + '</button></div><p class="gm-result" id="mkResult"></p></section></div>';
  const houseColor = { alliance: "var(--alliance)", horde: "var(--horde)", neutral: "var(--gold)" };
  splitBar(document.getElementById("mkHouses"), (MARKET.houses || []).map(h => ({ label: words.mkHouse[h.key] || h.key, count: h.auctions, color: houseColor[h.key] || "var(--gold)" })));
  const sellerColor = { ahbot: "var(--gold)", bots: "var(--realm)", players: "var(--accent)", gone: "var(--text-muted)" };
  splitBar(document.getElementById("mkSellers"), (MARKET.sellers || []).map(s => ({ label: words.mkSeller[s.key] || s.key, count: s.auctions, color: sellerColor[s.key] })));
  splitBar(document.getElementById("mkQualities"), (MARKET.qualities || []).map(q => ({ label: words.mkQuality[q.key] || q.key, count: q.auctions, color: QUALITY_COLORS[q.key] || "#888" })));
  rankedList(document.getElementById("mkClasses"), (MARKET.classes || []).map(c => ({ name: words.mkClass[c.key] || "#" + c.key, auctions: c.auctions, value: c.value })),
    { value: r => r.auctions, unit: lang === "fr" ? "enchères" : "auctions", line2: r => "", waiting: words.mkEmpty });
  lineChart(document.getElementById("mkHistory"), MARKET.history || [], { value: p => p.auctions, label: words.mkHistory, unit: "" });
}

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-ahbot]");
  if (!button) return;
  const what = button.dataset.ahbot;
  if (what === "empty" && !window.confirm(SW().mkEmptyConfirm)) return;
  const out = document.getElementById("mkResult");
  out.textContent = "…";
  const result = await gmPost({ action: "ahbot", what: what });
  out.className = "gm-result " + (result.ok ? "ok" : "bad");
  out.textContent = (result.ok ? SW().gmDone : SW().gmFailed) + " · " + (result.answer || result.error || "");
});

/* ------------------------------------------------------------- game master ---- */
let GMDATA = null, GM_PICK = null, GM_FILTER = "";

async function loadGm() {
  GMDATA = await getJson("/api/gm").catch(error => ({ error: String(error) }));
  renderGm();
}

async function gmPost(body) {
  try {
    const answer = await fetch("/api/gm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return await answer.json();
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function gmClassName(id) {
  const names = (LAST && LAST.classNames) || {};
  return names[id] || "#" + id;
}

function renderGm() {
  const host = document.getElementById("gmPage");
  if (!host || !GMDATA) return;
  const words = SW();
  if (GMDATA.error && !GMDATA.players) { host.innerHTML = '<div class="banner">' + esc(GMDATA.error) + "</div>"; return; }
  const players = (GMDATA.players || []).filter(p => !GM_FILTER || (p.name + " " + p.account).toLowerCase().includes(GM_FILTER));
  const rows = players.map(p => '<tr class="' + (p.online ? "" : "offline") + (GM_PICK === p.name ? " picked" : "") + '" data-gm-pick="' + esc(p.name) + '">' +
    '<td><span class="name">' + esc(p.name) + "</span>" + (p.banned ? ' <span class="tag bad">' + esc(words.gmBanned) + "</span>" : "") +
    (p.muted ? ' <span class="tag warn">' + esc(words.gmMuted) + "</span>" : "") + (p.gm ? ' <span class="tag">' + esc(words.gmGmLevels[p.gm] || "GM " + p.gm) + "</span>" : "") +
    '<div class="meta">' + esc(gmClassName(p.cls)) + " · " + esc(RACES[p.race] || "") + (p.zoneName ? " · " + esc(p.zoneName) : "") + "</div></td>" +
    '<td class="r num">' + p.level + "</td><td>" + esc(p.account) + '</td><td class="r">' + (p.online ? '<span class="dot"></span> ' + esc(words.gmNow) : p.lastSeen ? esc(ago(p.lastSeen)) : "–") + "</td></tr>").join("");
  const pick = (GMDATA.players || []).find(p => p.name === GM_PICK);
  const journal = (GMDATA.journal || []).map(j => '<li class="' + (j.ok ? "ok" : "bad") + '"><span class="when num">' + esc(when(j.ts)) +
    "</span><code>" + esc(j.command) + "</code>" + (j.answer ? '<div class="meta">' + esc(j.answer.slice(0, 220)) + "</div>" : "") + "</li>").join("");
  const online = !!GMDATA.console;
  host.innerHTML =
    '<section class="card gm-console"><h2>' + esc(words.gmConsole) + ' <span class="sub"><span class="dot ' + (online ? "" : "off") + '"></span> ' +
      esc(online ? words.gmOn(GMDATA.raPort) : words.gmOffline) + "</span></h2>" +
      '<label class="gm-label" for="gmText">' + esc(words.gmMessage) + '</label><textarea id="gmText" rows="2" maxlength="200"></textarea>' +
      '<div class="gm-buttons"><button class="btn" type="button" data-gm="announce">' + esc(words.gmAnnounce) + '</button>' +
      '<button class="btn" type="button" data-gm="notify">' + esc(words.gmNotify) + '</button>' +
      '<button class="btn" type="button" data-gm="saveall">' + esc(words.gmSave) + '</button><span class="meta">' + esc(words.gmMessageHelp) + "</span></div>" +
      '<p class="gm-result" id="gmResult"></p></section>' +
    '<div class="grid wide"><section class="card"><h2>' + esc(words.gmPlayers) + ' <span class="sub">' + esc(words.gmPlayersHelp) + "</span></h2>" +
      '<input class="gm-filter" id="gmFilter" type="search" placeholder="' + esc(words.gmFilter) + '" value="' + esc(GM_FILTER) + '">' +
      (rows ? '<div class="scroll"><table class="gm-table"><thead><tr><th>' + esc(words.gmName) + '</th><th class="r">' + esc(words.gmLevel) +
        "</th><th>" + esc(words.gmAccount) + '</th><th class="r">' + esc(words.gmLastSeen) + "</th></tr></thead><tbody>" + rows + "</tbody></table></div>"
        : '<p class="empty">' + esc(words.gmNone) + "</p>") + "</section>" +
    '<section class="card gm-actions">' + (pick ? gmActionsHtml(pick) : '<h2>' + esc(words.gmActions.replace(/\s+$/, "")) + '</h2><p class="empty">' + esc(words.gmPick) + "</p>") +
      '<h2 class="later">' + esc(words.gmJournal) + '</h2><ul class="gm-journal">' + (journal || '<li class="empty">' + esc(words.gmJournalEmpty) + "</li>") + "</ul></section></div>";
  const filter = document.getElementById("gmFilter");
  filter.addEventListener("input", () => {
    GM_FILTER = filter.value.trim().toLowerCase();
    const at = filter.selectionStart;
    renderGm();
    const again = document.getElementById("gmFilter");
    again.focus();
    again.setSelectionRange(at, at);
  });
}

function gmActionsHtml(p) {
  const words = SW();
  const field = (id, label, type, extra) => '<input id="' + id + '" type="' + (type || "text") + '" placeholder="' + esc(label) + '" aria-label="' + esc(label) + '"' + (extra || "") + ">";
  return "<h2>" + esc(words.gmActions) + '<span class="gold">' + esc(p.name) + '</span> <span class="sub">' + esc(p.account) + "</span></h2>" +
    '<div class="gm-row"><button class="btn small" data-gm="kick">' + esc(words.gmKick) + '</button><button class="btn small" data-gm="revive">' + esc(words.gmRevive) + "</button></div>" +
    '<div class="gm-row"><span class="gm-what">' + esc(words.gmUnstuck) + '</span><button class="btn small" data-gm="unstuck" data-where="inn">' + esc(words.gmInn) +
      '</button><button class="btn small" data-gm="unstuck" data-where="graveyard">' + esc(words.gmGraveyard) + '</button><button class="btn small" data-gm="unstuck" data-where="startzone">' + esc(words.gmStart) + "</button></div>" +
    '<div class="gm-row">' + field("gmMinutes", words.gmMinutes, "number", ' min="1" max="10080" value="15"') + field("gmMuteReason", words.gmReason) +
      '<button class="btn small" data-gm="mute">' + esc(words.gmMute) + '</button><button class="btn small" data-gm="unmute">' + esc(words.gmUnmute) + "</button></div>" +
    '<div class="gm-row">' + field("gmLevelValue", words.gmLevel, "number", ' min="1" max="80" value="' + p.level + '"') + '<button class="btn small" data-gm="level">' + esc(words.gmSetLevel) + "</button></div>" +
    '<div class="gm-row">' + field("gmGoldValue", "or / gold", "number", ' min="1" max="100000" value="100"') + '<button class="btn small" data-gm="money">' + esc(words.gmGold) + "</button></div>" +
    '<div class="gm-row">' + field("gmItemValue", words.gmItemId, "number", ' min="1"') + field("gmItemCount", words.gmCount, "number", ' min="1" max="200" value="1"') +
      '<button class="btn small" data-gm="items">' + esc(words.gmItem) + "</button></div>" +
    '<div class="gm-row danger">' + field("gmBanDuration", words.gmDuration, "text", ' value="1d"') + field("gmBanReason", words.gmReason) +
      '<button class="btn small" data-gm="ban">' + esc(words.gmBan) + '</button><button class="btn small" data-gm="unban">' + esc(words.gmUnban) + "</button></div>" +
    '<div class="gm-row danger"><select id="gmLevelGm" aria-label="' + esc(words.gmGmLevel) + '">' + words.gmGmLevels.map((label, i) =>
      '<option value="' + i + '"' + (i === p.gm ? " selected" : "") + ">" + i + " · " + esc(label) + "</option>").join("") +
      '</select><button class="btn small" data-gm="gmlevel">' + esc(words.gmGmLevel) + "</button></div>" +
    '<p class="gm-result" id="gmPickResult"></p>';
}

const GM_CONFIRM = ["kick", "ban", "gmlevel", "level", "money", "items", "mute"];
document.addEventListener("click", async event => {
  const row = event.target.closest("[data-gm-pick]");
  if (row) { GM_PICK = row.dataset.gmPick; renderGm(); return; }
  const button = event.target.closest("[data-gm]");
  if (!button || !GMDATA) return;
  const action = button.dataset.gm, words = SW();
  const value = id => (document.getElementById(id) || {}).value;
  const pick = (GMDATA.players || []).find(p => p.name === GM_PICK) || {};
  const body = { action: action, guid: pick.guid, account: pick.account };
  if (action === "announce" || action === "notify") body.text = value("gmText");
  if (action === "unstuck") body.where = button.dataset.where;
  if (action === "mute") { body.minutes = value("gmMinutes"); body.reason = value("gmMuteReason"); }
  if (action === "level") body.level = value("gmLevelValue");
  if (action === "money") body.gold = value("gmGoldValue");
  if (action === "items") { body.item = value("gmItemValue"); body.count = value("gmItemCount"); }
  if (action === "ban") { body.duration = value("gmBanDuration"); body.reason = value("gmBanReason"); }
  if (action === "gmlevel") body.level = value("gmLevelGm");
  if (GM_CONFIRM.includes(action) && !window.confirm(words.gmConfirm(button.textContent, pick.name || ""))) return;
  const out = document.getElementById(["announce", "notify", "saveall"].includes(action) ? "gmResult" : "gmPickResult");
  out.className = "gm-result";
  out.textContent = "…";
  button.disabled = true;
  const result = await gmPost(body);
  button.disabled = false;
  out.className = "gm-result " + (result.ok ? "ok" : "bad");
  out.textContent = (result.ok ? words.gmDone : words.gmFailed) + " · " + (result.answer || result.error || "");
  const keep = out.textContent, keepClass = out.className, keepId = out.id;
  await loadGm();
  const again = document.getElementById(keepId);
  if (again) { again.textContent = keep; again.className = keepClass; }
});

/* ------------------------------------------------------------- page switch ---- */
function showServerPage(page) {
  clearInterval(perfTimer);
  if (page === "server") { loadPerf(); perfTimer = setInterval(() => { if (!document.hidden) loadPerf(); }, 30000); }
  if (page === "market") loadMarket();
  if (page === "gm") loadGm();
}

document.getElementById("langButton").addEventListener("click", () => {
  if (PAGE === "server") renderPerf();
  if (PAGE === "market") renderMarket();
  if (PAGE === "gm") renderGm();
});
showServerPage(PAGE);
