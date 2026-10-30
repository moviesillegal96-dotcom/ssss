"""Draws the launcher icon (Bud, the potted plant, on a green tile) at every density."""
import os, sys
from PIL import Image, ImageDraw

res = sys.argv[1]
for name, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    S = 512  # draw large, then downscale for smooth edges
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([20, 20, 492, 492], radius=112, fill="#e8f5e9")
    d.ellipse((126, 70, 256, 190), fill="#4caf50")
    d.ellipse((256, 70, 386, 190), fill="#4caf50")
    d.rectangle((246, 140, 266, 250), fill="#388e3c")
    d.polygon([(146, 260), (366, 260), (340, 450), (172, 450)], fill="#d7845b")
    d.rounded_rectangle((128, 236, 384, 286), radius=14, fill="#c26d45")
    d.ellipse((200, 320, 232, 352), fill="#3e2723")
    d.ellipse((280, 320, 312, 352), fill="#3e2723")
    d.arc((216, 340, 296, 404), 20, 160, fill="#3e2723", width=12)
    out = os.path.join(res, f"mipmap-{name}")
    os.makedirs(out, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(os.path.join(out, "ic_launcher.png"))
