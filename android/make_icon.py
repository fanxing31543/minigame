# -*- coding: utf-8 -*-
"""生成 APK 用的启动图标（192px，圆角方块 + 星星，和站点 favicon 一致）"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

OUT = r"C:\websites_apk\app\src\main\res\drawable\ic_launcher.png"
SIZE = 192


def star(size, bg=(11, 15, 38), fg=(240, 246, 255), accent=(96, 165, 250)):
    s = size * 4
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # 圆角方块底
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.22), fill=bg + (255,))

    cx = cy = s / 2.0
    R = s * 0.30
    r = R * 0.26

    pts = []
    for i in range(8):
        ang = -math.pi / 2 + i * math.pi / 4
        rad = R if i % 2 == 0 else r
        pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang)))

    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.polygon(pts, fill=accent + (120,))
    glow = glow.filter(ImageFilter.GaussianBlur(s * 0.05))
    im = Image.alpha_composite(im, glow)

    d = ImageDraw.Draw(im)
    d.polygon(pts, fill=fg + (255,))

    return im.resize((size, size), Image.LANCZOS)


os.makedirs(os.path.dirname(OUT), exist_ok=True)
star(SIZE).save(OUT, optimize=True)
print(OUT, os.path.getsize(OUT), "bytes")
