"""Draws the launcher icon (a white check on a blue-to-violet tile) and the notification icon at every density."""
import os, sys
from PIL import Image, ImageDraw

res = sys.argv[1]
TOP, BOTTOM = (43, 74, 158), (90, 63, 179)


def check(d, S, color, width):
    pts = [(S * .27, S * .52), (S * .44, S * .68), (S * .74, S * .34)]
    d.line(pts, fill=color, width=width, joint="curve")
    r = width / 2
    for x, y in pts:
        d.ellipse([x - r, y - r, x + r, y + r], fill=color)


for name, size in {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}.items():
    S = size * 4  # draw large, then downscale for smooth edges
    grad = Image.new("RGBA", (S, S))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        t = y / (S - 1)
        gd.line([(0, y), (S, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip(TOP, BOTTOM)) + (255,))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([S * .04, S * .04, S * .96, S * .96], radius=S * .24, fill=255)
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    img.paste(grad, (0, 0), mask)
    check(ImageDraw.Draw(img), S, (255, 255, 255, 255), int(S * .105))
    out = os.path.join(res, f"mipmap-{name}")
    os.makedirs(out, exist_ok=True)
    img.resize((size, size), Image.LANCZOS).save(os.path.join(out, "ic_launcher.png"))

    # Status bar icon: white on transparent, 24dp.
    n = size // 2
    N = n * 8
    stat = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stat)
    sd.ellipse([N * .08, N * .08, N * .92, N * .92], outline=(255, 255, 255, 255), width=int(N * .075))
    check(sd, N, (255, 255, 255, 255), int(N * .095))
    out = os.path.join(res, f"drawable-{name}")
    os.makedirs(out, exist_ok=True)
    stat.resize((n, n), Image.LANCZOS).save(os.path.join(out, "ic_stat.png"))
