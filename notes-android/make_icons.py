"""Draws the launcher icon (a white note with an urgent first line, on a blue tile) at every density."""
import os, sys
from PIL import Image, ImageDraw

res = sys.argv[1]
BLUE, WHITE, URGENT, LINE = (41, 71, 207, 255), (255, 255, 255, 255), (194, 65, 12, 255), (176, 186, 204, 255)
for name, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    S = size * 4  # draw large, then downscale for smooth edges
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([S * .04, S * .04, S * .96, S * .96], radius=S * .22, fill=BLUE)
    d.rounded_rectangle([S * .25, S * .2, S * .75, S * .8], radius=S * .06, fill=WHITE)
    for i, (y, w, color) in enumerate([(.33, .34, URGENT), (.46, .34, LINE), (.59, .34, LINE), (.72, .2, LINE)]):
        h = .055 if i == 0 else .04
        d.rounded_rectangle([S * .33, S * (y - h / 2), S * (.33 + w), S * (y + h / 2)], radius=S * h / 2, fill=color)
    out = os.path.join(res, f"mipmap-{name}")
    os.makedirs(out, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(os.path.join(out, "ic_launcher.png"))
