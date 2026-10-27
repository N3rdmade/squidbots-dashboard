# 3D character equipment viewer

The Mail Center now offers **Show on 3D character**. It uses
[`wotlk-model-viewer`](https://github.com/WarhoopAll/wotlk-model-viewer),
which is designed for WoW 3.3.5a and supports equipping armor and weapons.

The renderer runs in the user's browser, while model-data files are served
by the **private** SquidBots dashboard from the Linux host. The WoW game
server is unaffected.

## Required model data: one-time server install

The upstream renderer ships separately from its WoW model data.
Download the matching [official model-data release](https://github.com/WarhoopAll/wotlk-model-viewer/releases/tag/data)
into `~/coa-server/assets/wotlk-model-data` on Ubuntu:

```bash
cd ~/coa-server/tools/squidbots-dashboard-test
python3 tools/install-wotlk-viewer-assets.py --list
python3 tools/install-wotlk-viewer-assets.py
```

The installer supports ZIP and TAR release assets. If the upstream data
release contains only another format or a different directory layout,
installation needs adapting and the UI will display an error. Assets are
not added to the Git repository.

The optional private `dashboard.json` property is:

```json
"wotlkViewerDir": "/home/hellhorde/coa-server/assets/wotlk-model-data"
```

Without it, that path is the default. The asset server route is private:
`/wotlk-model-data/...`. Check `/api/character-viewer-config` for readiness.
**Model-data availability and rendering have not been verified against this
server yet.**

## How to use

1. Open `http://localhost:18089/#mail` over the established SSH tunnel.
2. Choose **Show on 3D character** in Item Preview.
3. Select a wearable armor piece or weapon in the item catalog.
4. The viewer maps `item_template.InventoryType` to its character equipment
   slot and uses `item_template.displayid` for appearance.

**Limits:** Standard 3.3.5a models may render; CoA custom assets are not
included in upstream WotLK model data. Some items have no visible mesh, and
the exact mapping and model-data package still require integration testing.
This is not equivalent to a complete CoA player paper-doll with custom races.

The custom browser-based MPQ/M2 proof-of-concept remains available in the
separate item-mode preview but is experimental.
