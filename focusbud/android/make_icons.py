"""Draws the launcher icon (a tan battle-droid head in profile on a dark tile) at every density."""
import os, sys
from PIL import Image, ImageDraw

res = sys.argv[1]
TAN, SHADE, LINE, DARK = "#dcc79c", "#b9a273", "#5e4d30", "#1b2433"

S = 512  # draw large, then downscale for smooth edges
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([20, 20, 492, 492], radius=112, fill=DARK)

# Shoulders, backpack and a thin jointed neck
d.rounded_rectangle((120, 400, 340, 500), radius=28, fill=SHADE)
d.rectangle((120, 470, 340, 492), fill=SHADE)
d.rounded_rectangle((96, 360, 170, 470), radius=14, fill=TAN)  # backpack
d.rectangle((188, 262, 206, 404), fill=SHADE)
for y in (296, 330, 364):
    d.rounded_rectangle((182, y, 212, y + 12), radius=4, fill=LINE)

# Long flat head: domed back, straight top, blunt snout
d.ellipse((100, 160, 220, 276), fill=TAN)
d.polygon([(158, 162), (404, 196), (404, 246), (196, 274), (160, 274)], fill=TAN)
d.polygon([(196, 260), (404, 236), (404, 246), (196, 274)], fill=SHADE)  # underside shadow
d.rounded_rectangle((392, 192, 446, 250), radius=14, fill=TAN)  # snout
d.rounded_rectangle((430, 198, 446, 244), radius=6, fill=SHADE)
d.line([(232, 206), (392, 220)], fill=LINE, width=5)  # face seam
d.line([(300, 214), (300, 252)], fill=LINE, width=4)

# Recessed eye socket
d.ellipse((140, 182, 212, 254), fill=SHADE)
d.ellipse((150, 192, 202, 244), fill=LINE)
d.ellipse((160, 202, 192, 234), fill="#1a140c")

for name, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    out = os.path.join(res, f"mipmap-{name}")
    os.makedirs(out, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(os.path.join(out, "ic_launcher.png"))
