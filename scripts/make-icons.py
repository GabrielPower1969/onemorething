"""Raster icons from the brand mark (a solid dot on paper). Run: python3 scripts/make-icons.py"""
from PIL import Image, ImageDraw

PAPER, INK = (250, 250, 247, 255), (17, 17, 17, 255)


def dot(size: int, radius_ratio: float, bg=PAPER) -> Image.Image:
    scale = 4  # supersample for smooth edges
    s = size * scale
    img = Image.new("RGBA", (s, s), bg)
    r = s * radius_ratio
    c = s / 2
    ImageDraw.Draw(img).ellipse((c - r, c - r, c + r, c + r), fill=INK)
    return img.resize((size, size), Image.LANCZOS)


dot(180, 0.16).convert("RGB").save("public/apple-touch-icon.png")
dot(64, 0.22).save("public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
dot(512, 0.16).convert("RGB").save("public/icon-512.png")
print("icons written")
