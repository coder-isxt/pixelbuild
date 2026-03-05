Cosmetic PNG assets folder

How to add a new cosmetic:
1) Put your PNG into one of:
   - assets/cosmetics/clothes/
   - assets/cosmetics/pants/
   - assets/cosmetics/hats/
   - assets/cosmetics/wings/
   - assets/cosmetics/swords/
2) Add or edit the item entry in items.js and set:
   - id
   - slot list (shirts/pants/hats/wings/swords)
   - image: "<slot>/<file>.png"

Notes:
- PNG with transparent background is recommended.
- Missing image files automatically fall back to the old procedural cosmetic rendering.
- Suggested base sizes:
  shirts: around 20x14 (torso area)
  pants: around 14x10 (legs area)
  hats: around 20x10 (bottom of image is the attach point)
  wings: around 36x22 or 40x28
  swords: around 14x6
