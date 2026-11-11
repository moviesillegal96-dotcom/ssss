"""Draws the launcher icon (a white checklist on a blue tile) at every density."""
import os
import sys
from PIL import Image, ImageDraw

res = sys.argv[1]
for name, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    S = size * 4  # draw large, then downscale for smooth edges
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([S * .04, S * .04, S * .96, S * .96], radius=S * .22, fill=(59, 91, 219, 255))
    white, w = (255, 255, 255, 255), int(S * .06)
    for row, y in enumerate((.30, .50, .70)):
        y *= S
        if row < 2:  # a tick
            d.line([S * .24, y, S * .30, y + S * .06, S * .40, y - S * .07], fill=white, width=w, joint="curve")
        else:        # an empty box
            d.rounded_rectangle([S * .24, y - S * .065, S * .37, y + S * .065], radius=S * .03, outline=white, width=int(S * .035))
        d.line([S * .48, y, S * .76, y], fill=white, width=w)
        for x in (.48, .76):
            d.ellipse([S * x - w / 2, y - w / 2, S * x + w / 2, y + w / 2], fill=white)
    out = os.path.join(res, "mipmap-" + name)
    os.makedirs(out, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(os.path.join(out, "ic_launcher.png"))
