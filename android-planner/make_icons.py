"""Draws the launcher icon (a wallet with a three-part budget bar on a navy tile) at every density."""
import os, sys
from PIL import Image, ImageDraw

res = sys.argv[1]
NAVY, PAPER = (20, 27, 45, 255), (244, 246, 251, 255)
NEEDS, WANTS, FUTURE = (57, 135, 229, 255), (235, 104, 52, 255), (27, 175, 122, 255)
for name, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    S = size * 4  # draw large, then downscale for smooth edges
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([S * .04, S * .04, S * .96, S * .96], radius=S * .22, fill=NAVY)
    # wallet body with a clasp
    d.rounded_rectangle([S * .20, S * .27, S * .80, S * .62], radius=S * .07, fill=PAPER)
    d.rounded_rectangle([S * .58, S * .37, S * .86, S * .52], radius=S * .075, fill=NAVY)
    d.rounded_rectangle([S * .61, S * .40, S * .80, S * .49], radius=S * .045, fill=PAPER)
    d.ellipse([S * .645, S * .415, S * .705, S * .475], fill=NAVY)
    # 50 / 30 / 20 bar
    x0, x1, y0, y1, gap = S * .20, S * .80, S * .68, S * .76, S * .02
    w = x1 - x0 - 2 * gap
    a, b = x0 + w * .5, x0 + w * .5 + gap + w * .3
    d.rounded_rectangle([x0, y0, a, y1], radius=S * .025, fill=NEEDS)
    d.rounded_rectangle([a + gap, y0, b, y1], radius=S * .025, fill=WANTS)
    d.rounded_rectangle([b + gap, y0, x1, y1], radius=S * .025, fill=FUTURE)
    out = os.path.join(res, f"mipmap-{name}")
    os.makedirs(out, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(os.path.join(out, "ic_launcher.png"))
