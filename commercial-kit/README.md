# PeroXcity: "Put It on the Rig" (photoreal spot, 1:14)

A production pack for any image-to-video tool that takes first/last-frame pins and reference images (Veo, Kling, Runway, Luma and similar). Each shot runs 6 seconds. There are 12 shots (72 s), then the logo card for 2 s, for **1:14 total**.

All paths are relative to the site root. Generated keyframes are in `commercial-kit/keyframes/`.

---

## 1. Global look (prepend to every shot prompt)

> Photoreal live-action commercial, 16:9, 24 fps, full-frame cinema camera, natural lens character, real skin texture. South Florida suburb: one-story stucco and lap-siding ranch houses, royal and queen palms, St. Augustine grass, concrete driveways. Warm, low late-afternoon sun; long navy-blue shadows; a cool blue fill highlight inside the shade. Grade: warm gold highlights, deep navy shadows, gentle contrast. Smooth, motivated camera moves only. Natural human motion.

## 2. Global negative prompt (append to every shot)

> text, words, letters, numbers, captions, subtitles, logos, brand marks, signage, license plates, watermarks, on-screen graphics, arrows, printed clothing, branded spray cans, cartoon, CGI look, plastic skin, extra fingers, warped hands, morphing containers, flicker, bare hands touching a jug, pouring concentrate, mixing chemicals, small bottle added to a jug, galvanized metal or bare aluminum being sprayed, chain-link fence, metal gutters in the spray path, wilted or brown plants near the PeroXcity spray

**One exception to "no logos":** the black label on the real PeroXcity jug, tote and drum stays, because it *is* the product. Everything else stays unbranded, including the bleach jug, truck, clothing and tools.

## 3. Safety and claims rules for the whole spot

- **Gloves and eye protection.** Anyone who handles the jug wears blue nitrile gloves. Anyone who sprays also wears clear safety glasses. The spot never shows the 35% concentrate being opened or poured.
- **Part B.** No shot shows mixing, so Part B never meets straight concentrate on screen. Keep it that way: no Part B bottle and no pouring between containers. The site's rule is Part A, then water, then Part B, and never Part B into undiluted Part A.
- **Metals and paint. Note that this differs from the brief.** The site says to **avoid** galvanized metal and bare aluminum, including inexpensive aluminum gutters, not just test them. It says to **test** painted surfaces and painted aluminum in a small hidden spot first, because poorly prepped paint can blister. Keep galvanized metal, bare aluminum gutters and screen frames out of every spray path.

---

## 4. Voiceover script

Tone: a calm, dry, contractor-to-contractor voice. Read at about 2.3 words per second. Each line starts about 0.3 s into its shot and ends at least 0.5 s before the cut.

| # | In | VO line (as briefed) | Suggested safer read, if needed |
|---|----|----------------------|----------------------------------|
| 1 | 0:00 | Tired of coming home smelling like a swimming pool? | n/a |
| 2 | 0:06 | Bleach cleans. It also brings fumes, plant burn, and paint risk. | n/a |
| 3 | 0:12 | Homeowners search bleach cleaning, and a lot of them hesitate. | n/a |
| 4 | 0:18 | Perox City is the peroxide cleaner you add to the truck. | Use the brand spelling **PeroXcity** in the script, pronounced "Perox City." |
| 5 | 0:24 | It gets into the grime without changing organic house paint. | "It gets deep into the grime, and it's gentle on house paint." The site says to test painted surfaces first, so "without changing" is stronger than the site supports. |
| 6 | 0:30 | No harsh fumes. Your crew and their landscaping can stay close. | "No chlorine fumes. Far easier on your crew and the landscaping." The site avoids "plant-safe" wording and says to rinse plants. |
| 7 | 0:36 | The mix stays effective for months, so you waste less product. | n/a (the site supports this) |
| 8 | 0:42 | Biodegradable, with no known allergens. Easier for cautious homeowners. | "Biodegradable, breaks down to water and oxygen. Easier for cautious homeowners." **"No known allergens" doesn't appear anywhere on the site.** Confirm it before you use it. |
| 9 | 0:48 | Don't throw the bleach away. Add this for customers who refuse it. | n/a |
| 10 | 0:54 | Same strength, no rinse. PeroXcity comes up visibly cleaner. | "Same strength, side by side, no rinse. PeroXcity came up visibly cleaner." This ties the line to the specific test. The label still says to rinse in normal use. |
| 11 | 1:00 | Jugs for the truck. Totes and drums when you need volume. | n/a |
| 12 | 1:06 | Leave the competition behind. Reach out, and put it on the rig. | n/a |
| logo | 1:12 | (silence, music button) | n/a |

---

## 5. Shot prompts

Each entry lists the frames to pin, the references, and the motion prompt. Paste the **Global look** before the motion prompt and the **Global negative** after it.

### Shot 1: The smell (0:00 to 0:06)
- **First frame:** `commercial-kit/keyframes/01-first.jpg`
- **Last frame:** `commercial-kit/keyframes/01-last.jpg`
- **Motion:** A sunburned exterior-cleaning contractor in a plain navy polo steps down from the open driver door of a plain white work truck onto the concrete driveway. He pinches his collar and pulls it up to his nose, then winces. The camera starts behind the open door and pushes in steadily, ending on a close-up of his face. Warm sun on one cheek, cool blue shade on the other.
- **Note:** In the generated last frame his hand is at his nose but the collar lift is subtle. If the model skips the collar, add "the polo collar fabric visibly stretches up over his nose."

### Shot 2: What bleach costs (0:06 to 0:12)
- **First frame:** `keyframes/02-first.jpg`
- **Last frame:** `keyframes/02-last.jpg`
- **Motion:** A plain unlabeled translucent jug sits in a black crate in the truck bed. The camera drifts slowly right, off the truck, across a foundation hedge whose leaf tips are browned and burned, and settles on the painted lap siding of a one-story house. The jug stays still. No people.

### Shot 3: The homeowner already searched it (0:12 to 0:18)
- **First frame:** `keyframes/03-first.jpg`
- **Last frame:** `keyframes/03-last.jpg`
- **Motion:** On a covered front porch, a homeowner lowers a phone with the screen facing away and folds their arms, looking down the steps. The camera tilts and drifts slowly from the homeowner's face down the porch steps to a washer in a navy polo and gloves who waits patiently by a coiled hose at the foot of the steps. No one speaks.

### Shot 4: Add it to the truck (0:18 to 0:24)
- **First frame, as briefed:** `product-rtu.jpg`, with `product-rtu.jpg` as the reference.
- **Problem:** That photo shows the jug on a wooden ledge against grey siding, with no tailgate and no hands. Pinning it means the shot opens on siding and has to invent a tailgate mid-push.
- **Recommended:** Pin `keyframes/04-alt-first-tailgate.jpg` as the first frame and keep `product-rtu.jpg` as the product reference.
- **Motion:** The white handled gallon jug stays fixed on the lowered tailgate of a white work truck. Two hands in blue nitrile gloves rest flat on the tailgate either side of it. The camera pushes in slowly and evenly until the jug fills the center third. The jug and the label don't move or deform. Palms sway softly behind.

### Shot 5: Deeper, paint-safe clean (0:24 to 0:30)
- **The existing clip `peroxcity-pavers.mp4` only partly works.** It's vertical phone footage of paver *edging* foaming beside a rock bed. A labeled 5-gallon jug sits in frame, and there's **no painted siding**, so the paint half of the line goes unshown. Use it only in a 9:16 cutdown.
- **Fallback for 16:9:** first frame `keyframes/05-fallback-first.jpg`, last frame `keyframes/05-fallback-last.jpg`.
- **Motion:** A fan of clear solution from a wand held by a gloved hand starts at the left edge of a mildewed concrete paver walk and sweeps to the right edge. Along the wet path the dark growth lightens to clean grey. The painted siding along the top of the frame keeps exactly the same color throughout. The camera drifts slightly right, keeping pace with the wet line.

### Shot 6: No harsh fumes (0:30 to 0:36)
- **First frame:** `keyframes/06-first.jpg`
- **Last frame:** `keyframes/06-last.jpg`
- **Motion:** A crew member in blue nitrile gloves and clear safety glasses sprays a low fan of solution along the bottom of the house siding. A second person stands a few feet away beside a full, healthy green shrub. The crew member lowers the wand and both turn toward each other, relaxed, with no masks and no recoiling. The camera slides left to right from the spray fan to the green shrub.

### Shot 7: The mix lasts (0:36 to 0:42)
- **First frame:** `keyframes/07-first.jpg`, a cool blue morning garage shelf.
- **Last frame:** `keyframes/07-last.jpg`, warm late-day light with a gloved hand tipping the jug.
- **Reference:** `product-rtu.jpg`
- **Motion:** Locked-off camera. The white jug sits on the shaded garage shelf. Over the shot the light moves from cool morning blue to low late-afternoon gold, and the shadows swing and lengthen like a time-lapse. In the final second a hand in a blue nitrile glove enters, grips the handle, and tips the jug toward the plastic pump sprayer while the jug's base stays on the shelf.

### Shot 8: Easy yes (0:42 to 0:48)
- **First frame:** `keyframes/08-first.jpg`
- **Last frame:** `keyframes/08-last.jpg`
- **Motion:** A homeowner kneels at the edge of a wet, freshly rinsed driveway with a golden retriever sitting calmly beside them. In the background a washer rinses the far edge of the concrete with a hose. The camera pushes in from the whole driveway to a medium close-up of the homeowner and the dog. The dog stays seated and calm. Light glints on the wet concrete.

### Shot 9: Don't throw the bleach away (0:48 to 0:54)
- **First frame:** `keyframes/09-first.jpg`
- **Last frame:** `keyframes/09-last.jpg`
- **Reference:** `product-rtu.jpg`
- **Motion:** The camera holds at tailgate height looking into the truck bay. A hand in a blue nitrile glove reaches past the plain unlabeled jug in the rear crate, lifts the white PeroXcity jug from the back of the bay, carries it forward, and sets it on the tailgate beside the hose reel. The unlabeled jug never moves.

### Shot 10: Same strength, no rinse (0:54 to 1:00)
- **First frame, as briefed:** `gallery-compare.jpg`.
- **Problem:** That photo has a logo banner, red arrows and caption text burned in, which breaks the "no words or logos" rule. It's also vertical (9:16).
- **Option:** `keyframes/10-first-clean-plate.jpg` is the same photo with the graphics removed by AI retouching. The cleaned patches weren't meant to change, but **check it against the original before airing**, because the shot makes a comparison claim. For 16:9, either crop to the top half (the PeroXcity patch) or place it over a softly blurred copy of itself.
- **Motion:** Camera only. The slab is locked and nothing on it changes. A slow, even push in from the full slab toward the lighter cleaned patch.

### Shot 11: Jugs, totes, drums (1:00 to 1:06)
- **First frame, as briefed:** `product-bulk.jpg`, with `product-rtu.jpg` and `product-kit.jpg` as references.
- **Problem:** `product-bulk.jpg` is a white studio cutout of the tote and drum only. It has no gallon jug and no South Florida light, so the jug-to-tote truck move can't start from it.
- **Recommended:** Pin `keyframes/11-alt-first-lineup.jpg`, which shows the jug, tote and drum in one row in late sun. Keep all three product photos as references.
- **Motion:** The camera trucks left to right at low height, from the white gallon jug past the caged white tote to the blue 55-gallon drum. All containers stay perfectly still and undeformed.

### Shot 12: Close (1:06 to 1:12, then logo to 1:14)
- **Existing clips:** `peroxcity-curb.mp4` is the same paver-edging footage as shot 5 and has no truck exit, so it doesn't work here. I couldn't inspect `peroxcity-street.mp4` (14 MB) because this environment has no video tools, so check whether it contains a left-to-right truck exit. If it does, use it.
- **Fallback:** first frame `keyframes/12-fallback-first.jpg`, last frame `keyframes/12-fallback-last.jpg`.
- **Motion:** A plain white work truck drives from the left third of the frame to the right edge, down a palm-lined residential street in golden light. The camera stays low at the curb and pans with the truck. Long palm shadows stripe the road.
- **Logo card:** hard cut to `logo-header.png`, centered on pure black, for 2.0 s. Use no animation, or a 6-frame fade in.

---

## 6. Edit sheet

| # | In | Out | Source | Transition out |
|---|----|-----|--------|----------------|
| 1 | 0:00 | 0:06 | Generated (01 first and last) | Cut |
| 2 | 0:06 | 0:12 | Generated (02) | Cut |
| 3 | 0:12 | 0:18 | Generated (03) | Cut on the washer's look |
| 4 | 0:18 | 0:24 | Generated (04 alt or product-rtu) | Cut |
| 5 | 0:24 | 0:30 | Generated (05 fallback) or peroxcity-pavers.mp4 in 9:16 | Cut |
| 6 | 0:30 | 0:36 | Generated (06) | Cut |
| 7 | 0:36 | 0:42 | Generated (07) | Cut |
| 8 | 0:42 | 0:48 | Generated (08) | Cut |
| 9 | 0:48 | 0:54 | Generated (09) | Cut |
| 10 | 0:54 | 1:00 | Image-to-video on the compare plate | Cut |
| 11 | 1:00 | 1:06 | Generated (11 alt or product-bulk) | Cut |
| 12 | 1:06 | 1:12 | peroxcity-street.mp4 if it works, else generated (12) | Hard cut |
| logo | 1:12 | 1:14 | logo-header.png on black | End |

**Music:** warm, mid-tempo acoustic or soft-funk bed. Keep it light under the bleach section (shots 1 to 3), let it lift at shot 4 and resolve on the logo.
**Sound design:** truck door (1), crate creak (2), screen-door hush (3), spray hiss (5, 6), dog collar jingle (8), tailgate thunk (9), engine pass-by (12).
**Deliverables:** a 16:9 master at 1920×1080 or 4K. For a 9:16 cutdown, shots 5 and 10 can use the vertical originals.
