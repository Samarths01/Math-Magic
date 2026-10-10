# Sprout warrior: art direction and delivery brief

**Version:** v1, 2026-10-07 · **Owner:** Samarth · **For:** an AI image tool (and whoever cleans up its output)
**Replaces:** the placeholder SVG in `prototype/warrior.js`. Catalog: `prototype/armory.js` (15 items) plus 5 starter pieces.

How to use this brief:
1. Paste **Part A** (style) plus one prompt from **Part B** into the image tool.
2. Follow the workflow in **Part C** to get a consistent character and separate layers.
3. Export the files exactly as **Part D** describes and hand the folder back to Claude. Claude checks them against **Part E** and wires them into the app.

---

## Part A: Creative direction (paste this into every prompt)

```
STYLE
Cute chibi knight mascot for a children's math app (ages 7–10). Flat vector illustration,
bold clean outlines in dark navy (#1F2A44), two-tone flat fills (a base colour plus one darker
shade for edges), no gradients, no texture, no 3D, no photorealism. Friendly, brave, cosy.
Toy-like, never menacing.

CHARACTER
About two heads tall: a big round white face, a small body. Simple face: two round dot eyes
and a small curved smile. Gender-neutral, no visible hair. A small two-leaf sprout grows from
the top of the head and stays visible above every helmet (it is the brand mark). Lavender
tunic (#EFEAF8) with violet trim (#5E3FA3), a V-neck and a violet belt.

POSE (identical in every image)
Front view, standing, feet together, centred. A round shield held on the image-left side at
hip height. A sword held upright on the image-right side, tip pointing up, hand at hip height.
Cape hangs behind the body from the shoulders.

PALETTE (use only these)
Starter violet #7C5CBF / #5E3FA3 · Bronze #C58A4B / #7A4E26 · Silver #C3CBD8 / #5E6A80 ·
Gold #E8B923 / #8A6500 · Night navy #2B3A67 / #141C33 · Royal purple #5E3FA3 / #3E2775 ·
Accent violet #9B7FD9 · Pale gold #FFF4C4 · Pale silver #E6EBF2 · Leaf white #F2F4F8 ·
Ink #1F2A44 · White #FFFFFF. No green anywhere (green means "Correct" in the app).

BACKGROUND
Transparent. No ground, no shadow, no scenery, no text, no frame.
```

```
NEGATIVE PROMPT
green, gradients, glow, realistic, 3D render, texture, painterly, blood, scars, angry face,
sharp menacing weapons, spikes, skulls, text, logo, watermark, background scenery, ground
shadow, side view, three-quarter view, extra limbs, hair
```

### Tier language (how rarity should look)

| Tier | Material | Silhouette rule |
|---|---|---|
| Starter | violet | Small and simple. The base look every child starts with. |
| Common | bronze or navy | Same shapes as starter, new material. |
| Rare | silver, or navy with gold stars | Slightly bigger, plus **one** decoration (plume, star, gem, small wings). |
| Legendary | gold or royal purple | **A new shape**: crown, kite shield, floor-length cape, tall blade, tall winged boots. |

**Rule:** the four tiers of a slot must be tellable apart in black and white. Colour alone isn't enough.

Wearing all five legendaries adds a set bonus: a soft gold aura with a few sparkles. The app can keep drawing this itself.

---

## Part B: Asset list and prompts

Prompt template (one per row below):

```
[PART A STYLE BLOCK]
SUBJECT: the Sprout knight wearing <ITEM DESCRIPTION>. Every other piece is the plain violet
starter gear. Same character, same pose, same proportions as the reference image.
```

| File id | Slot | Tier | Item description for the prompt |
|---|---|---|---|
| `helmet-starter` | helmet | starter | a rounded violet dome helmet with cheek guards, face fully open |
| `bronze-helm` | helmet | common | the same dome helmet in bronze |
| `plume-helm` | helmet | rare | a silver dome helmet with one tall violet (#9B7FD9) plume on the image-right side |
| `crown-helm` | helmet | legendary | a gold helmet topped with a three-point crown and a small violet gem |
| `shield-starter` | shield | starter | a small round violet shield |
| `bronze-shield` | shield | common | a round bronze shield with an inner ring |
| `star-shield` | shield | rare | a larger round silver shield with a white five-point star |
| `sun-shield` | shield | legendary | a gold kite-shaped shield (flat top, pointed bottom) with a white sun emblem |
| `cape-starter` | cape | starter | a short violet cape to the knees |
| `night-cape` | cape | common | a short navy cape |
| `starry-cape` | cape | rare | a longer navy cape with three small gold stars near the hem |
| `royal-cape` | cape | legendary | a floor-length royal purple cape with a gold trim along the hem |
| `sword-starter` | sword | starter | a short violet toy sword with a rounded tip |
| `bronze-sword` | sword | common | a short bronze sword |
| `gem-sword` | sword | rare | a longer pale-silver sword with a violet gem in the guard |
| `gold-sword` | sword | legendary | a tall pale-gold sword with a wide gold guard and a violet gem |
| `boots-starter` | boots | starter | simple violet boots |
| `bronze-boots` | boots | common | the same boots in bronze |
| `winged-boots` | boots | rare | silver boots with small white wings at the ankles |
| `golden-boots` | boots | legendary | taller gold boots with flared cuffs and large pale-gold wings |

Item names must stay as listed in `prototype/armory.js`. Art can change; ids and names don't.

---

## Part C: Workflow (keeping one character consistent)

AI image tools are good at one great picture and weak at many perfectly aligned parts. So work in this order:

1. **Lock the character.** Generate 6–8 versions of the knight in full starter gear. Pick one and save it as **the reference**. Every later prompt attaches it as a character or style reference, if the tool supports that.
2. **Generate four full sets** with the reference: all starter, all common, all rare, all legendary. These four images are the source for every layer.
3. **Check one mixed outfit** (for example crown helm, bronze shield, starry cape, starter sword, winged boots) to confirm pieces from different tiers look like they belong together.
4. **Cut into layers.** Separate each full set into the slot layers in Part D, all on the same canvas.
   - Tools that export SVG directly make this easier (for example Recraft).
   - Raster tools (PNG output) need vectorizing or careful cutting in an editor.
   - Expect this step to need manual cleanup. It's the step an illustrator does best.
5. **Export** per Part D, and include the four full-set images as previews.

Check that the tool's terms allow commercial use of what it generates. Record the tool, model version, prompts and seeds in the manifest.

---

## Part D: Delivery format (what Claude consumes)

### Folder

```
art/warrior/v1/
  manifest.json
  base-body.svg        tunic, belt, legs-under-boots area (never changes)
  base-hands.svg       both hands
  base-head.svg        head circle and face
  base-sprout.svg      the two-leaf sprout
  helmet-starter.svg   … one file per row in Part B (20 gear files)
  preview/
    set-starter.png  set-common.png  set-rare.png  set-legendary.png  mixed-1.png
```

### One shared canvas

- **SVG (preferred):** every file uses `viewBox="0 0 120 150"`, with no `width` or `height`. Each layer is drawn **exactly where it sits on the full figure**, so files stack with no offsets.
- **PNG fallback:** 480 × 600 px (4× the viewBox), transparent, same rule: stacked, not cropped.
- The current placeholder already uses this frame, so new art drops straight in.

### Where each layer goes (units of the 120 × 150 frame)

| Layer | Keep inside (x, y) | Anchor |
|---|---|---|
| cape | x 10–110, y 70–150 | hangs from the shoulders at (40, 74) and (80, 74) |
| boots | x 20–100, y 104–146 | soles at y ≈ 140; feet centred at x 50 and x 70 |
| base-body | x 34–86, y 70–124 | tunic box from (37, 72) to (83, 122) |
| sword | x 74–110, y 8–114 | grip centred on the right hand at (92, 106), blade straight up |
| base-hands | two hands, radius ≈ 6 | left hand (28, 106), right hand (92, 106) |
| shield | x 4–50, y 76–136 | centred near (27, 100), covering the left hand |
| base-sprout | x 36–84, y 0–20 | stalk rises from the top of the head at x 60 |
| base-head | circle at (60, 52), radius 24 | eyes at (52, 56) and (68, 56), smile at y 63–68 |
| helmet | x 28–104, y 0–70 | sits on the head. **Never covers the face window** x 42–78, y 46–72, and never fully hides the sprout. |

### Stacking order (back to front)

`aura → cape → boots → base-body → sword → base-hands → shield → base-sprout → base-head → helmet`

### SVG rules

- Flat fills and strokes only. No gradients, filters, masks, embedded images, text or `<style>` blocks. Colours go inline (`fill="#…"`).
- Only colours from the Part A palette. **No green.**
- Wrap each layer in one `<g id="<file id>">`.
- Outlines are about 2–3 units thick at this scale, so the knight reads at 48 px tall.
- Keep each file under 20 KB.

### manifest.json

```json
{
  "version": "v1",
  "frame": { "viewBox": "0 0 120 150" },
  "source": { "tool": "", "model": "", "date": "", "licence": "", "notes": "" },
  "layers": [
    { "id": "base-body", "kind": "base", "file": "base-body.svg" },
    { "id": "helmet-starter", "kind": "gear", "slot": "helmet", "tier": "starter", "file": "helmet-starter.svg" },
    { "id": "crown-helm", "kind": "gear", "slot": "helmet", "tier": "legendary", "file": "crown-helm.svg",
      "prompt": "", "seed": "" }
  ]
}
```

One entry per file, 24 in total: 4 base and 20 gear.

---

## Part E: What Claude checks when the folder comes back

1. Every file parses and uses `viewBox="0 0 120 150"`. The manifest lists every file and every catalog id.
2. Only palette colours, and nothing in the green hue range.
3. Each layer stays inside its zone. The face window is clear and the sprout shows above every helmet.
4. **Grayscale test:** the four tiers of each slot are distinguishable without colour.
5. Composite renders of all four full sets and a sample of mixed outfits, checked at 48 px (run companion) and 200 px (Armory preview), compared with the preview images.

Then Claude replaces the drawing functions in `prototype/warrior.js` with layer lookups. Not-yet-earned slots keep showing as dashed outlines of the starter shape, drawn by the app. The gold set-bonus aura also stays app-drawn unless an `aura.svg` is supplied.
