"""Draws the launcher icon (a white knight on a green tile) at every density."""
import os, sys
from PIL import Image, ImageDraw, ImageFont

res = sys.argv[1]
FONTS = ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"]
font_path = next((f for f in FONTS if os.path.exists(f)), None)
for name, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    S = size * 4  # draw large, then downscale for smooth edges
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([S * .04, S * .04, S * .96, S * .96], radius=S * .22, fill=(47, 125, 79, 255))
    font = ImageFont.truetype(font_path, int(S * .72)) if font_path else ImageFont.load_default()
    glyph = "♞"
    box = d.textbbox((0, 0), glyph, font=font)
    x = (S - (box[2] - box[0])) / 2 - box[0]
    y = (S - (box[3] - box[1])) / 2 - box[1]
    d.text((x, y), glyph, font=font, fill=(255, 255, 255, 255), stroke_width=int(S * .012), stroke_fill=(20, 50, 30, 255))
    out = os.path.join(res, f"mipmap-{name}")
    os.makedirs(out, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(os.path.join(out, "ic_launcher.png"))
