# Builds public/hero/*.webp from the captures in out/.
from PIL import Image, ImageDraw
import os, sys
OUT = os.environ.get("SHOTS_OUT") or os.path.join(os.path.dirname(__file__), "out")
HERO = os.path.join(os.path.dirname(__file__), "..", "..", "public", "hero")
EXT = "--with-extension" in sys.argv
o = lambda n: Image.open(os.path.join(OUT, n)).convert("RGB")
has = lambda n: os.path.exists(os.path.join(OUT, n))
sizes = {}

def save(im, name):
    im.save(os.path.join(HERO, name + ".webp"), "WEBP", quality=88, method=6)
    sizes[name] = im.size

def width(im, w):
    return im if im.width == w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)

# Extension (only with --with-extension): paste the sharp top-level panel over
# the iframe (x 1267, y 36, 327x752 CSS at 1.5x).
if EXT:
    for n in ("extension-clip", "extension-fill"):
        base, panel = o(n + ".png"), o(n + "-panel-1x5.png")
        mask = Image.new("L", panel.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, panel.width - 1, panel.height + 40), radius=15, fill=255)
        base.paste(panel, (round(1267 * 1.5), round(36 * 1.5)), mask)
        save(base, n)
    clip = o("extension-clip-panel.png"); save(clip.crop((0, 0, clip.width, 1170)), "extension-clip-mobile")
    fill = o("extension-fill-panel.png"); save(fill.crop((0, 0, fill.width, 1350)), "extension-fill-mobile")
# The Claude connector shot is of Claude's own UI and is kept as is.

for n in ("pipeline-dashboard", "pipeline-drilldown", "fitness-check", "candidate-profile", "ats-qualification",
          "ai-authenticity", "tailored-rewriter", "cover-letter", "ai-providers", "resumes"):
    if has(n + ".png"): save(o(n + ".png"), n)
for n in ("pipeline-dashboard", "pipeline-drilldown", "fitness-check", "candidate-profile", "ats-qualification",
          "tailored-rewriter", "cover-letter"):
    if has(n + "-mobile.png"): save(width(o(n + "-mobile.png"), 1200), n + "-mobile")

if has("import-sheet.png"): save(o("import-sheet.png"), "import-sheet")

# Keep the width/height on the landing page in step with the files.
import re
page = os.path.join(os.path.dirname(__file__), "..", "..", "src", "components", "LandingPage.tsx")
src = open(page).read()
for name, (w, h) in sizes.items():
    src = re.sub(r'(src: "/hero/%s\.webp",(?: alt: "[^"]*",)? width: )\d+(, height: )\d+' % re.escape(name), r"\g<1>%d\g<2>%d" % (w, h), src)
open(page, "w").write(src)

for k, v in sorted(sizes.items()):
    print(k, v[0], v[1])
