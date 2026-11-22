#!/usr/bin/env python3
"""Compose the news-image-20261122 front page (1024x1024) from three
AI-generated story illustrations, two PIL-drawn graphics and PIL-set type.
Working file only: the entry itself is just entry.png + main.ts.
Deterministic: every random choice uses a fixed seed.
"""
import math
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1024, 1024
ASSETS = "/home/hatch/workspace/makefun/build-news22/assets"
OUT = "/home/hatch/workspace/makefun/build-news22/entry.png"

PAPER = (247, 244, 236)
INK = (22, 24, 29)
RED = (185, 28, 28)
GREY = (90, 95, 106)

SERIF_B = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=fnt) <= max_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def crop_to(im, tw, th, focus_y=0.5):
    """Center-crop (with a vertical focus 0..1) to the target aspect, resize."""
    sw, sh = im.size
    target = tw / th
    if sw / sh > target:  # too wide: crop width
        nw = int(sh * target)
        x0 = (sw - nw) // 2
        box = (x0, 0, x0 + nw, sh)
    else:  # too tall: crop height around focus_y
        nh = int(sw / target)
        y0 = int((sh - nh) * focus_y)
        box = (0, y0, sw, y0 + nh)
    return im.crop(box).resize((tw, th), Image.LANCZOS)


def bezier(p0, p1, p2, n=60):
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t**2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t**2 * p2[1]
        pts.append((x, y))
    return pts


def bahrain_graphic(w, h):
    """Night Gulf skyline with missile trails, drawn at 2x then downscaled."""
    S = 2
    w2, h2 = w * S, h * S
    rng = random.Random(20261122)
    im = Image.new("RGB", (w2, h2), (6, 13, 31))
    d = ImageDraw.Draw(im)
    # vertical gradient sky
    for y in range(h2):
        t = y / h2
        r = int(6 + (22 - 6) * t)
        g = int(13 + (40 - 13) * t)
        b = int(31 + (63 - 31) * t)
        d.line([(0, y), (w2, y)], fill=(r, g, b))
    # stars
    for _ in range(70):
        x, y = rng.uniform(0, w2), rng.uniform(0, h2 * 0.55)
        r = rng.uniform(0.6, 1.8) * S
        a = rng.randint(90, 220)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(a, a, min(255, a + 20)))
    # skyline
    x = 0
    base = h2
    while x < w2:
        bw = rng.randint(28, 70) * S
        bh = rng.randint(28, 95) * S
        d.rectangle([x, base - bh, x + bw, base], fill=(4, 7, 14))
        for _ in range(rng.randint(0, 5)):
            wx = x + rng.randint(3, max(4, bw - 6))
            wy = base - bh + rng.randint(6, max(7, bh - 8))
            d.rectangle([wx, wy, wx + 2 * S, wy + 3 * S], fill=(255, 196, 90))
        x += bw + rng.randint(2, 10) * S
    # horizon flash glow (right side): soft, low, distant
    glow = Image.new("RGB", (w2, h2), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse([w2 * 0.70, h2 * 0.60, w2 * 0.95, h2 * 1.00], fill=(255, 120, 30))
    glow = glow.filter(ImageFilter.GaussianBlur(36 * S))
    # screen the glow onto the sky
    from PIL import ImageChops
    im = ImageChops.screen(im, glow.point(lambda v: int(v * 0.32)))
    d = ImageDraw.Draw(im)
    # missile trails: glow layer + bright core
    trails = [
        ((w2 * 0.06, h2 * 0.98), (w2 * 0.30, h2 * 0.10), (w2 * 0.62, h2 * 0.42)),
        ((w2 * 0.20, h2 * 0.98), (w2 * 0.48, h2 * 0.02), (w2 * 0.82, h2 * 0.30)),
        ((w2 * 0.38, h2 * 0.98), (w2 * 0.60, h2 * 0.22), (w2 * 0.94, h2 * 0.55)),
    ]
    layer = Image.new("RGB", (w2, h2), (0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for p0, p1, p2 in trails:
        pts = bezier(p0, p1, p2)
        ld.line(pts, fill=(255, 140, 40), width=7 * S, joint="curve")
    layer = layer.filter(ImageFilter.GaussianBlur(6 * S))
    im = ImageChops.screen(im, layer)
    d = ImageDraw.Draw(im)
    for p0, p1, p2 in trails:
        pts = bezier(p0, p1, p2)
        d.line(pts, fill=(255, 236, 190), width=2 * S, joint="curve")
        hx, hy = pts[-1]
        d.ellipse([hx - 4 * S, hy - 4 * S, hx + 4 * S, hy + 4 * S],
                  fill=(255, 250, 230))
    return im.resize((w, h), Image.LANCZOS)


def markets_chart(w, h):
    """Falling candlestick chart, drawn at 2x then downscaled."""
    S = 2
    w2, h2 = w * S, h * S
    rng = random.Random(1122)
    im = Image.new("RGB", (w2, h2), (255, 255, 255))
    d = ImageDraw.Draw(im)
    # grid
    for i in range(1, 4):
        y = h2 * i // 4
        d.line([(8 * S, y), (w2 - 8 * S, y)], fill=(232, 232, 232), width=1)
    # candles descending left to right, sharp drop at the end
    n = 14
    pad_l, pad_r, pad_t, pad_b = 14 * S, 14 * S, 12 * S, 12 * S
    cw = (w2 - pad_l - pad_r) / n
    price = h2 * 0.30
    closes = []
    for i in range(n):
        cx = pad_l + cw * i + cw / 2
        drop = (h2 * 0.62) * (i / (n - 1)) ** 1.4
        jitter = rng.uniform(-4, 4) * S
        close = pad_t + drop + jitter
        op = close - rng.uniform(2, 9) * S
        hi = min(op, close) - rng.uniform(2, 7) * S
        lo = max(op, close) + rng.uniform(2, 7) * S
        col = (185, 28, 28) if close >= op else (22, 120, 60)
        d.line([(cx, hi), (cx, lo)], fill=col, width=max(1, S))
        d.rectangle([cx - cw * 0.28, min(op, close), cx + cw * 0.28,
                     max(op, close)], fill=col)
        closes.append((cx, close))
    # red trend line over the closes
    d.line(closes, fill=(185, 28, 28), width=3 * S, joint="curve")
    # arrowhead at the end
    ex, ey = closes[-1]
    d.polygon([(ex, ey + 12 * S), (ex - 8 * S, ey - 2 * S),
               (ex + 8 * S, ey - 2 * S)], fill=(185, 28, 28))
    d.rectangle([0, 0, w2 - 1, h2 - 1], outline=(200, 200, 200), width=1)
    return im.resize((w, h), Image.LANCZOS)


def main():
    page = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(page)

    # ---- masthead ----
    name_f = font(SERIF_B, 56)
    date_f = font(SANS_B, 30)
    name = "THE WORLD TODAY"
    nw = d.textlength(name, font=name_f)
    d.text(((W - nw) / 2, 22), name, font=name_f, fill=INK)
    date = "SUNDAY, 22 NOVEMBER 2026"
    dw = d.textlength(date, font=date_f)
    d.text(((W - dw) / 2, 88), date, font=date_f, fill=RED)
    d.line([(24, 132), (W - 24, 132)], fill=INK, width=3)
    d.line([(24, 138), (W - 24, 138)], fill=INK, width=1)

    # ---- lead story: COP31 ----
    cop = Image.open(f"{ASSETS}/media-generation-cop31-0-a2e3d486-9bdd-4eca-948b-08f6b4564284.webp").convert("RGB")
    page.paste(crop_to(cop, 580, 320, focus_y=0.45), (24, 150))
    tx = 620
    d.text((tx, 150), "CLIMATE  ·  ANTALYA", font=font(SANS_B, 20), fill=RED)
    hl = font(SANS_B, 48)
    d.text((tx, 180), "COP31", font=hl, fill=INK)
    d.text((tx, 232), "COLLAPSES", font=hl, fill=INK)
    sub = font(SANS, 21)
    y = 300
    for para in [
        "Climate talks end with no deal after the EU rejects a draft that never mentions fossil fuels.",
        "The EU, UK and Panama formally objected to the final text.",
    ]:
        for line in wrap(d, para, sub, 380):
            d.text((tx, y), line, font=sub, fill=INK)
            y += 28
        y += 8

    d.line([(24, 486), (W - 24, 486)], fill=INK, width=1)

    # ---- middle row ----
    mex = Image.open(f"{ASSETS}/media-generation-mexico-0-15fc7c25-efb3-4322-b0a2-91179ebacdc9.webp").convert("RGB")
    page.paste(bahrain_graphic(476, 146), (24, 500))
    page.paste(crop_to(mex, 476, 146, focus_y=0.55), (524, 500))
    kick = font(SANS_B, 18)
    head = font(SANS_B, 27)
    sub2 = font(SANS, 18)
    # Bahrain
    d.text((24, 654), "THE GULF", font=kick, fill=RED)
    d.text((24, 676), "IRAN STRIKES BAHRAIN", font=head, fill=INK)
    y = 712
    for line in wrap(d, "Missiles hit Bahrain; Tehran says US bases were the target.", sub2, 476):
        d.text((24, y), line, font=sub2, fill=INK)
        y += 24
    # Mexico
    d.text((524, 654), "MEXICO", font=kick, fill=RED)
    d.text((524, 676), "CARTEL BOSS CAPTURED", font=head, fill=INK)
    y = 712
    for line in wrap(d, "\u2018El Chapo Isidro\u2019 seized in Sinaloa raid; 11 killed.", sub2, 476):
        d.text((524, y), line, font=sub2, fill=INK)
        y += 24

    d.line([(24, 764), (W - 24, 764)], fill=INK, width=1)

    # ---- bottom row ----
    ukr = Image.open(f"{ASSETS}/media-generation-ukraine-0-f1da7fe8-7074-4711-bc9f-d9264227141c.webp").convert("RGB")
    page.paste(crop_to(ukr, 200, 156, focus_y=0.5), (24, 778))
    page.paste(markets_chart(200, 156), (524, 778))
    kick3 = font(SANS_B, 17)
    head3 = font(SANS_B, 24)
    sub3 = font(SANS, 17)
    # Ukraine
    d.text((238, 778), "UKRAINE", font=kick3, fill=RED)
    d.text((238, 800), "RUSSIA HITS", font=head3, fill=INK)
    d.text((238, 828), "KRYVYI RIH", font=head3, fill=INK)
    y = 860
    for line in wrap(d, "Missile strike on Zelenskyy\u2019s hometown kills 2 and wounds 60.", sub3, 262):
        d.text((238, y), line, font=sub3, fill=INK)
        y += 22
    # Markets
    d.text((738, 778), "MARKETS", font=kick3, fill=RED)
    d.text((738, 800), "STOCKS SLIDE", font=head3, fill=INK)
    d.text((738, 828), "INTO CORRECTION", font=head3, fill=INK)
    y = 860
    for line in wrap(d, "S&P 500 -3.7%, Nasdaq -5.3% as the AI sell-off spreads to Asia.", sub3, 262):
        d.text((738, y), line, font=sub3, fill=INK)
        y += 22

    # ---- briefs band ----
    d.rectangle([0, 948, W, H], fill=INK)
    label = "IN BRIEF   "
    items = ("Indonesia factory fire: 7 dead, 50 missing   \u2022   "
             "Gaza: four more killed   \u2022   "
             "Alcaraz v Zverev for ATP title")
    # shrink the type until the whole line fits with margins
    size = 16
    while size > 10:
        bf, bf2 = font(SANS_B, size), font(SANS, size)
        total = d.textlength(label, font=bf) + d.textlength(items, font=bf2)
        if total <= W - 48:
            break
        size -= 1
    x = (W - total) / 2
    d.text((x, 966), label, font=bf, fill=(255, 120, 100))
    d.text((x + d.textlength(label, font=bf), 966), items,
           font=bf2, fill=(255, 255, 255))

    page.save(OUT, "PNG", optimize=True)
    import os
    print("saved", OUT, os.path.getsize(OUT), "bytes")


if __name__ == "__main__":
    main()
