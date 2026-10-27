# Local CoA 3D Item Library

SquidBots Mail Center now uses **local exported GLB models**, with one GLB
per distinct *item display ID*. The dashboard does not access a Windows drive
and does not use the broken external ZAM model-loading path.

## Server configuration

In the **private**, existing `dashboard.json` on the Ubuntu SquidBots test
installation, add these two keys inside the existing object:

```json
"modelDir": "/home/hellhorde/coa-server/assets/models",
"tunnelPorts": [18089]
```

Make the model folder: `mkdir -p ~/coa-server/assets/models`.

The private HTTP handler serves only numeric filenames via
`/static/models/DISPLAY_ID.glb`. The API
`/api/model-available?display=DISPLAY_ID` checks for presence.

## Where models come from

Original 3.3.5a/CoA data is stored in the user's client `Data/*.MPQ`
archives. There is **no direct native MPQ/M2/BLP renderer or automated
conversion in this repository yet**. Merely pointing `modelDir` at
`C:\\COA` or copying MPQs into the model directory will NOT display them.

One supported route for preparing assets is [wow.export](https://github.com/Kruithne/wow.export),
which supports legacy MPQ installs and exporting models as glTF. Convert a
gltf + textures into a *binary GLB* using a glTF-compatible tool. The model
must correspond to the item's actual display ID and contain the required
textures. The CoA display ID is visible in the Mail Center.

For a quick proof of concept, start with one weapon such as the one you
selected, `Ramaladni's Blade of Culling` (display ID **56380**), export
its corresponding model with textures, and name the valid binary output
`56380.glb`. A visual correspondence must be checked; renaming some other
weapon's geometry to `56380.glb` would show the wrong appearance.

Transfer that GLB to the server with e.g. `scp` from Windows, or install
multiple exports in the server library using:

```bash
python3 tools/import-models.py --source ~/exported-glb --dest ~/coa-server/assets/models
```

After adding a GLB, simply reselect the item: no worldserver restart is
needed. Browser must load the open-source `model-viewer` web component from
Google's hosted URL; serving model geometry is local, but the rendering
component currently still requires internet. Vendoring that dependency is a
future step.

## Scope

- This path provides standalone 3D previews **only where corresponding GLBs
  have been imported**.
- Equippable body armor often isn't a standalone mesh; a dressed player
  needs a full character customization + equipped texture pipeline.
- Do not commit copyrighted game assets, full MPQ archives, or exported
  client models into the public GitHub repository.
- The test instance runs on Ubuntu port 8089, reached via SSH-forwarded
  `http://localhost:18089/#mail`; `tunnelPorts` avoids per-pull modifications
  to the Python server.
