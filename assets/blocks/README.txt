Block image system

Main block list:
- Edit blocks in blocks.js -> BLOCK_LIST

Common variables you can modify per block:
- id (number)
- key (string, used by commands/admin)
- name (string)
- solid (true/false)
- oneWay (platform behavior)
- liquid (water behavior)
- unbreakable (cannot break)
- stair (stair behavior)
- rotatable (right-click rotate)
- color (fallback draw color)
- icon/faIcon (toolbar fallback icon)
- image (relative PNG path under assets/blocks)

Image notes:
- If image exists and loads, world render + inventory icon use it.
- If image is missing, game falls back to color/icon rendering.

Suggested folders:
- assets/blocks/terrain/
- assets/blocks/special/
