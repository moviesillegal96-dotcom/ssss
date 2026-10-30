"""Draws the launcher icon (a stopwatch showing 10 with a sparkle, on a purple-to-pink tile) at every density."""
import os, sys
from PIL import Image, ImageDraw, ImageFont

res = sys.argv[1]
S = 512  # draw large, then downscale for smooth edges

# Diagonal purple-to-pink gradient, clipped to a rounded tile
grad = Image.new("RGBA", (S, S))
a, b = (109, 74, 255), (255, 93, 143)
for y in range(S):
    for x in range(0, S, 4):
        t = (x + y) / (2 * S)
        c = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)
        grad.paste(c, (x, y, x + 4, y + 1))
mask = Image.new("L", (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([20, 20, 492, 492], radius=112, fill=255)
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
img.paste(grad, (0, 0), mask)
d = ImageDraw.Draw(img)

# Stopwatch
d.rounded_rectangle((226, 84, 286, 120), radius=10, fill="white")
d.ellipse((116, 120, 396, 400), fill="white")
d.ellipse((140, 144, 372, 376), fill=(109, 74, 255))
fonts = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"]
path = next((f for f in fonts if os.path.exists(f)), None)
font = ImageFont.truetype(path, 120) if path else ImageFont.load_default()
box = d.textbbox((0, 0), "10", font=font)
d.text((256 - (box[2] + box[0]) / 2, 260 - (box[3] + box[1]) / 2), "10", font=font, fill="white")

# Sparkle
def star(cx, cy, r):
    k = r * 0.28
    d.polygon([(cx, cy - r), (cx + k, cy - k), (cx + r, cy), (cx + k, cy + k), (cx, cy + r), (cx - k, cy + k), (cx - r, cy), (cx - k, cy - k)], fill="white")
star(392, 130, 46)
star(110, 410, 26)

for name, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    out = os.path.join(res, f"mipmap-{name}")
    os.makedirs(out, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(os.path.join(out, "ic_launcher.png"))
