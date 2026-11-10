"""Draws the Planner icon (a white calendar with a check mark on an indigo tile).
Usage: make_icons.py <android res dir> [<web output dir>]"""
import os, sys
from PIL import Image, ImageDraw

INDIGO, WHITE = (79, 70, 229, 255), (255, 255, 255, 255)

def draw(size, full_bleed):
    S = size * 4  # draw large, then downscale for smooth edges
    img = Image.new("RGBA", (S, S), INDIGO if full_bleed else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if not full_bleed:
        d.rounded_rectangle([S * .04, S * .04, S * .96, S * .96], radius=S * .22, fill=INDIGO)
    d.rounded_rectangle([S * .24, S * .27, S * .76, S * .77], radius=S * .07, fill=WHITE)          # page
    d.rounded_rectangle([S * .24, S * .27, S * .76, S * .42], radius=S * .07, fill=(199, 196, 255, 255))  # header strip
    d.rectangle([S * .24, S * .36, S * .76, S * .42], fill=(199, 196, 255, 255))
    for x in (.36, .64):                                                                             # binder rings
        d.rounded_rectangle([S * (x - .025), S * .21, S * (x + .025), S * .33], radius=S * .025, fill=WHITE)
    d.line([S * .37, S * .59, S * .46, S * .68, S * .64, S * .50], fill=INDIGO, width=int(S * .06), joint="curve")  # check
    return img.resize((size, size), Image.LANCZOS)

res = sys.argv[1]
for name, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    out = os.path.join(res, f"mipmap-{name}")
    os.makedirs(out, exist_ok=True)
    draw(size, False).save(os.path.join(out, "ic_launcher.png"))
if len(sys.argv) > 2:  # home-screen icons for the web app (iPhone wants a square with no transparency)
    for size in (180, 512):
        draw(size, True).convert("RGB").save(os.path.join(sys.argv[2], f"planner-icon-{size}.png"))
