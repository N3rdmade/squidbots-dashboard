# CoA 3D model assets

The Mail page renders real 3D GLB models using a browser WebGL viewer.

## Asset lookup
For an item, the dashboard looks up `item_template.displayid`, then requests
`/api/model-available?display=DISPLAY_ID` and, if present, serves
`static/models/DISPLAY_ID.glb`. The viewer allows rotation and zoom. This is
intentionally keyed by **display ID**, because different item IDs can share an appearance.

## Providing assets
Place converted, legally distributable or privately held **GLB** assets in
`static/models/`. For example, a model associated with display ID 20110 is
`static/models/20110.glb`.

Original WoW 3.3.5a assets are typically packaged in MPQ archives; the world
database does **not** contain mesh/texture binaries. Extracting and converting
M2/BLP to GLB with correct weapon and armor appearance mapping is an external
import pipeline; it has not been implemented in this branch. A GLB file must
have valid 3D geometry and textures. Uploading an MPQ, DBC, BLP, or M2 with a
renamed extension will not work.

**Important:** The presence of 568,404 item records does *not* imply 568,404
unique 3D meshes. Many items are icon-only, share a display ID, or rely on
character-specific armor textures rather than a standalone model.

Do not commit proprietary client models to a public GitHub repository.
The viewer and server routes are shareable independently of asset files.
The current viewer uses the `model-viewer` web component loaded from Google's
CDN, so internet access is required for this component until it is vendored.
