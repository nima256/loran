/**
 * Derives single-colour masks from the supplied Loran logo.
 *
 * The logo artwork is cream shapes on a burgundy square. Splitting it into two
 * alpha masks — the lion mark and the LORAN wordmark — lets the UI paint the
 * *same* artwork in whatever colour a surface needs (cream on burgundy in the
 * header, burgundy on cream in the footer, cream on charcoal in dark mode).
 * Nothing is redrawn; only the ink colour changes, which is normal single-colour
 * logo usage.
 *
 * Requires Python + Pillow:  node scripts/extract-logo-masks.mjs
 */
import { execFileSync } from "node:child_process";

const python = `
from PIL import Image

src = Image.open("public/brand/loran-logo.png").convert("RGB")
w, h = src.size
px = src.load()

def is_ink(p):
    r, g, b = p
    return r > 185 and g > 172 and b > 155

def extract(y0, y1, out, pad=6):
    xs = [x for x in range(w) for y in range(y0, y1) if is_ink(px[x, y])]
    if not xs:
        raise SystemExit("no ink found in band")
    x0, x1 = max(0, min(xs) - pad), min(w, max(xs) + pad)
    mask = Image.new("RGBA", (x1 - x0, y1 - y0), (255, 255, 255, 0))
    mp = mask.load()
    for y in range(y0, y1):
        for x in range(x0, x1):
            r, g, b = px[x, y]
            # Alpha ramps with how close the pixel is to the cream ink, which
            # keeps the curve edges smooth instead of aliased.
            lum = (r * 0.299 + g * 0.587 + b * 0.114)
            a = max(0, min(255, int((lum - 90) * 255 / 110)))
            mp[x - x0, y - y0] = (255, 255, 255, a)
    mask.save(out)
    print(out, mask.size)

def tint(mask_path, rgb, out):
    """Paint an extracted mask in a flat brand colour."""
    mask = Image.open(mask_path)
    solid = Image.new("RGBA", mask.size, rgb + (0,))
    solid.putalpha(mask.getchannel("A"))
    solid.save(out)
    print(out, solid.size)

CREAM = (238, 230, 221)
BURGUNDY = (154, 28, 33)

# Bands measured from the source artwork.
extract(196, 664, "public/brand/loran-mark.png")
extract(684, 806, "public/brand/loran-wordmark.png")

# Flat-colour variants so the UI can use a plain <img> in either theme.
for name in ("mark", "wordmark"):
    tint(f"public/brand/loran-{name}.png", CREAM, f"public/brand/loran-{name}-cream.png")
    tint(f"public/brand/loran-{name}.png", BURGUNDY, f"public/brand/loran-{name}-burgundy.png")
`;

execFileSync("python3", ["-c", python], { stdio: "inherit" });
