#!/usr/bin/env python3
"""
Draws the content packs' decorative demo pictures as flat, clearly stylised illustrations.

    python3 tools/suite/content/make-images.py            # all pictures
    python3 tools/suite/content/make-images.py pic-seaside

Rules the drawings keep (see docs/suite/content-packs.md):
  * obviously an illustration: flat shapes, simple gradients, no photographic texture;
  * no people, no text, no flags, no religious symbols, no recognisable real place;
  * mixed aspect ratios (16:9, 4:3, 3:4 and one square) so letterboxing is exercised.

Output: public/suite/packs/<pack>/images/<id>.webp, about 1200 px on the long edge and at
most 120 KB each. Needs Pillow (11+) and numpy. The random generator is seeded, so the
output is repeatable. The script prints each file's size; `width`/`height` in the pack's
content.json must match (the suite-activities check verifies that).
"""
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
PACKS = os.path.join(ROOT, 'public', 'suite', 'packs')
SS = 2  # supersampling factor for smooth edges
MAX_BYTES = 120 * 1024


def hexrgb(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def vgradient(w, h, stops):
    """Vertical gradient; stops = [(0..1, '#hex'), ...]."""
    ys = np.linspace(0, 1, h)[:, None]
    pos = [p for p, _ in stops]
    cols = np.array([hexrgb(c)[:3] for _, c in stops], dtype=float)
    out = np.zeros((h, w, 3))
    for ch in range(3):
        out[:, :, ch] = np.interp(ys, pos, cols[:, ch]).repeat(w, axis=1)
    img = Image.fromarray(out.astype(np.uint8)).convert('RGBA')
    return img


class Canvas:
    def __init__(self, w, h, sky):
        self.w, self.h = w * SS, h * SS
        self.size = (w, h)
        self.img = vgradient(self.w, self.h, sky)

    def layer(self):
        return Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))

    def paste(self, layer, blur=0):
        if blur:
            layer = layer.filter(ImageFilter.GaussianBlur(blur * SS))
        self.img = Image.alpha_composite(self.img, layer)

    def P(self, x, y):
        """Fractional coordinates to pixels."""
        return (x * self.w, y * self.h)

    def poly(self, pts, colour, blur=0):
        lay = self.layer()
        ImageDraw.Draw(lay).polygon([self.P(x, y) for x, y in pts], fill=colour)
        self.paste(lay, blur)

    def ellipse(self, cx, cy, rx, ry, colour, blur=0, ref='w'):
        lay = self.layer()
        s = self.w if ref == 'w' else self.h
        box = [cx * self.w - rx * s, cy * self.h - ry * s, cx * self.w + rx * s, cy * self.h + ry * s]
        ImageDraw.Draw(lay).ellipse(box, fill=colour)
        self.paste(lay, blur)

    def ridge(self, base, amp, colour, waves, blur=0, bottom=1.02):
        """A hill line y = base + sum(amp*sin) across the width, filled below."""
        pts = []
        for i in range(0, 201):
            x = i / 200
            y = base
            for a, f, p in waves:
                y += amp * a * math.sin(2 * math.pi * (f * x + p))
            pts.append((x, y))
        pts += [(1.02, bottom), (-0.02, bottom)]
        self.poly(pts, colour, blur)

    def glow(self, cx, cy, r, colour, strength=1.0):
        lay = self.layer()
        d = ImageDraw.Draw(lay)
        R = r * self.w
        steps = 18
        for k in range(steps, 0, -1):
            rr = R * k / steps
            a = int(colour[3] * strength * (1 - k / steps) ** 2 / 2)
            d.ellipse([cx * self.w - rr, cy * self.h - rr, cx * self.w + rr, cy * self.h + rr], fill=colour[:3] + (a,))
        self.paste(lay, blur=r * 40)

    def tree(self, x, ground, height, colour, trunk):
        """A rounded, generic tree."""
        tw = height * 0.08
        self.poly([(x - tw / 2, ground), (x + tw / 2, ground), (x + tw / 3, ground - height * 0.5), (x - tw / 3, ground - height * 0.5)], trunk)
        rx = height * 0.28 * self.h / self.w
        for dx, dy, s in [(0, 0.62, 1.0), (-0.45, 0.5, 0.75), (0.45, 0.52, 0.8), (0, 0.85, 0.7)]:
            self.ellipse(x + dx * rx, ground - dy * height, rx * s, height * 0.26 * s * self.h / self.w, colour)

    def palm(self, x, ground, height, lean, colour, trunk):
        pts_l, pts_r = [], []
        for i in range(21):
            t = i / 20
            cx = x + lean * t * t
            cy = ground - height * t
            wdt = 0.012 * (1 - 0.4 * t)
            pts_l.append((cx - wdt, cy))
            pts_r.append((cx + wdt, cy))
        self.poly(pts_l + pts_r[::-1], trunk)
        tx, ty = x + lean, ground - height
        for ang in [-160, -130, -100, -70, -40, -15, 200]:
            a = math.radians(ang)
            length = height * 0.45
            ex = tx + math.cos(a) * length * self.h / self.w
            ey = ty + math.sin(a) * length * 0.55 + length * 0.25
            mx = (tx + ex) / 2
            my = min(ty, ey) - length * 0.12
            nx, ny = -(ey - ty), (ex - tx)
            nlen = math.hypot(nx, ny) or 1
            off = 0.018
            self.poly([(tx, ty), (mx + nx / nlen * off, my + ny / nlen * off), (ex, ey), (mx - nx / nlen * off * 0.4, my - ny / nlen * off * 0.4)], colour)

    def save(self, path):
        img = self.img.convert('RGB').resize(self.size, Image.LANCZOS)
        q = 82
        while True:
            img.save(path, 'WEBP', quality=q, method=6)
            if os.path.getsize(path) <= MAX_BYTES or q <= 40:
                break
            q -= 6
        return os.path.getsize(path), img.size, q


# ---------------------------------------------------------------------------------------
# The pictures
# ---------------------------------------------------------------------------------------

def river_dusk():
    c = Canvas(1200, 675, [(0, '#3b3f6e'), (0.35, '#8a6f9e'), (0.58, '#f2b48a'), (0.62, '#f7cf9c'), (1, '#f7cf9c')])
    c.glow(0.68, 0.55, 0.16, hexrgb('#ffd9a0'), 1.4)
    c.ellipse(0.68, 0.55, 0.045, 0.045, hexrgb('#ffe7b8'))
    c.ridge(0.52, 0.04, hexrgb('#7b6390'), [(1, 1.3, 0.1), (0.5, 3.1, 0.4)])
    c.ridge(0.57, 0.025, hexrgb('#5f4f7a'), [(1, 2.2, 0.7), (0.4, 5.0, 0.2)])
    # The river, reflecting the sky.
    water = vgradient(c.w, int(c.h * 0.4), [(0, '#e9a98a'), (0.4, '#9a7fa3'), (1, '#4c4a78')])
    lay = c.layer()
    lay.paste(water, (0, int(c.h * 0.6)))
    c.paste(lay)
    for k in range(9):
        y = 0.63 + k * 0.035
        wdt = 0.06 - k * 0.004
        c.poly([(0.68 - wdt, y), (0.68 + wdt, y), (0.68 + wdt * 0.8, y + 0.008), (0.68 - wdt * 0.8, y + 0.008)], hexrgb('#ffe2b0', 170 - k * 15))
    # Near bank on the left, far bank trees.
    c.poly([(-0.02, 0.6), (0.18, 0.6), (0.3, 0.72), (0.34, 1.02), (-0.02, 1.02)], hexrgb('#2f3a4f'))
    for x, hgt in [(0.05, 0.28), (0.14, 0.22), (0.22, 0.16)]:
        c.tree(x, 0.62, hgt, hexrgb('#2a3346'), hexrgb('#262c3a'))
    for x in [0.42, 0.47, 0.55, 0.86, 0.93]:
        c.tree(x, 0.585, 0.07, hexrgb('#4a3f66'), hexrgb('#433a5c'))
    # A small empty boat.
    c.poly([(0.44, 0.78), (0.58, 0.78), (0.555, 0.805), (0.465, 0.805)], hexrgb('#2b2740'))
    c.poly([(0.505, 0.78), (0.508, 0.70), (0.512, 0.78)], hexrgb('#2b2740'))
    for x, y in [(0.3, 0.2), (0.34, 0.24), (0.38, 0.19)]:
        c.poly([(x - 0.012, y - 0.008), (x, y), (x + 0.012, y - 0.008), (x, y + 0.004)], hexrgb('#3a3558'))
    return c


def hills_morning():
    c = Canvas(1200, 900, [(0, '#a9d4ea'), (0.45, '#e6f0e4'), (0.6, '#fbf1d6'), (1, '#fbf1d6')])
    c.glow(0.25, 0.3, 0.14, hexrgb('#fff4c2'), 1.2)
    c.ellipse(0.25, 0.3, 0.05, 0.05, hexrgb('#fff6d0'))
    for cx, cy, s in [(0.62, 0.16, 1.0), (0.82, 0.24, 0.7)]:
        for dx, dy, r in [(0, 0, 0.06), (0.05, 0.01, 0.045), (-0.05, 0.015, 0.04)]:
            c.ellipse(cx + dx * s, cy + dy, r * s, r * s * 0.6, hexrgb('#ffffff', 220))
    c.ridge(0.45, 0.05, hexrgb('#a7c7b0'), [(1, 1.1, 0.3), (0.4, 2.7, 0.6)])
    c.ridge(0.53, 0.05, hexrgb('#86b58f'), [(1, 1.6, 0.8), (0.3, 3.3, 0.1)])
    c.ridge(0.64, 0.05, hexrgb('#6aa26e'), [(1, 0.9, 0.55), (0.4, 2.4, 0.3)])
    c.ridge(0.78, 0.04, hexrgb('#4f8a55'), [(1, 1.3, 0.05), (0.3, 3.0, 0.5)])
    # A winding path.
    pts_l, pts_r = [], []
    for i in range(31):
        t = i / 30
        y = 0.66 + 0.36 * t
        x = 0.58 + 0.08 * math.sin(t * 5) - 0.1 * t
        wdt = 0.004 + 0.05 * t * t
        pts_l.append((x - wdt, y))
        pts_r.append((x + wdt, y))
    c.poly(pts_l + pts_r[::-1], hexrgb('#e8d7ac'))
    # A small house with a pitched roof, no signs.
    hx, hy = 0.7, 0.6
    c.poly([(hx - 0.04, hy), (hx + 0.04, hy), (hx + 0.04, hy - 0.06), (hx - 0.04, hy - 0.06)], hexrgb('#f3e3c3'))
    c.poly([(hx - 0.05, hy - 0.06), (hx + 0.05, hy - 0.06), (hx, hy - 0.11)], hexrgb('#b5644a'))
    c.poly([(hx - 0.008, hy), (hx + 0.008, hy), (hx + 0.008, hy - 0.03), (hx - 0.008, hy - 0.03)], hexrgb('#8a5a3c'))
    for x, g, hgt in [(0.12, 0.8, 0.2), (0.2, 0.82, 0.14), (0.86, 0.75, 0.16), (0.93, 0.78, 0.2), (0.78, 0.62, 0.08)]:
        c.tree(x, g, hgt, hexrgb('#3f7a48'), hexrgb('#6b4b34'))
    return c


def seaside():
    c = Canvas(1200, 675, [(0, '#8fcbe8'), (0.5, '#d8eef2'), (1, '#d8eef2')])
    for cx, cy, s in [(0.2, 0.15, 1.0), (0.55, 0.1, 0.8), (0.85, 0.2, 0.9)]:
        for dx, dy, r in [(0, 0, 0.05), (0.04, 0.01, 0.035), (-0.04, 0.012, 0.03)]:
            c.ellipse(cx + dx * s, cy + dy, r * s, r * s * 0.55, hexrgb('#ffffff', 230))
    sea = vgradient(c.w, int(c.h * 0.32), [(0, '#3f9bb8'), (1, '#6cc1c9')])
    lay = c.layer()
    lay.paste(sea, (0, int(c.h * 0.5)))
    c.paste(lay)
    rnd = random.Random(7)
    for k in range(26):
        y = 0.53 + rnd.random() * 0.26
        x = rnd.random()
        wdt = 0.02 + 0.04 * (y - 0.5)
        c.poly([(x - wdt, y), (x + wdt, y), (x + wdt * 0.7, y + 0.004), (x - wdt * 0.7, y + 0.004)], hexrgb('#e4f6f6', 150))
    # Foam line and sand.
    c.ridge(0.8, 0.012, hexrgb('#f4fbf7'), [(1, 3.0, 0.2), (0.5, 7.0, 0.5)])
    c.ridge(0.815, 0.012, hexrgb('#f0dcae'), [(1, 3.0, 0.2), (0.5, 7.0, 0.5)])
    c.ridge(0.9, 0.01, hexrgb('#e6cc98'), [(1, 1.5, 0.1)])
    # A distant sail and two palms.
    c.poly([(0.62, 0.49), (0.66, 0.49), (0.655, 0.497), (0.625, 0.497)], hexrgb('#5a4a3a'))
    c.poly([(0.64, 0.488), (0.641, 0.43), (0.665, 0.486)], hexrgb('#fbf5e8'))
    c.palm(0.12, 0.93, 0.62, 0.05, hexrgb('#2f7a4f'), hexrgb('#8b6a47'))
    c.palm(0.2, 0.95, 0.48, -0.03, hexrgb('#3d8b5a'), hexrgb('#9a7852'))
    c.palm(0.9, 0.94, 0.55, -0.06, hexrgb('#2f7a4f'), hexrgb('#8b6a47'))
    return c


def flowers():
    c = Canvas(900, 1200, [(0, '#f6efe2'), (0.6, '#eef0dd'), (1, '#dfe7cc')])
    rnd = random.Random(3)
    # Stems with leaves; each stem carries one bloom.
    blooms = []
    for k in range(15):
        x = 0.08 + (k + rnd.random() * 0.8) / 15 * 0.84
        top = 0.2 + rnd.random() * 0.42
        bend = (rnd.random() - 0.5) * 0.08
        c.poly([(x - 0.006, 1.02), (x + 0.006, 1.02), (x + bend + 0.004, top), (x + bend - 0.004, top)], hexrgb('#5f8f4e'))
        for s_ in (-1, 1):
            ly = top + 0.15 + rnd.random() * 0.3
            lx = x + bend * (1 - (ly - top) / (1.02 - top))
            c.poly([(lx, ly), (lx + s_ * 0.09, ly - 0.05), (lx + s_ * 0.12, ly - 0.09), (lx + s_ * 0.04, ly - 0.035)], hexrgb('#79a861'))
        blooms.append((x + bend, top, rnd.choice(['five', 'round']), rnd.choice(['#f2a65a', '#e56b6f', '#f7d56a', '#f4b6c2', '#ffffff'])))
    for x, y, kind, col in sorted(blooms, key=lambda b: b[1]):
        r = 0.055 if kind == 'five' else 0.045
        if kind == 'five':
            for i in range(5):
                a = 2 * math.pi * i / 5 + 0.3
                c.ellipse(x + math.cos(a) * r * 0.9, y + math.sin(a) * r * 0.9 * 0.75, r * 0.62, r * 0.62, hexrgb(col))
            c.ellipse(x, y, r * 0.3, r * 0.3, hexrgb('#b8742e'))
        else:
            for ring, shade in [(1.0, 0.85), (0.72, 1.0), (0.45, 0.9)]:
                base = hexrgb(col)
                colr = tuple(int(v * shade) for v in base[:3]) + (255,)
                c.ellipse(x, y, r * ring, r * ring, colr)
    # A low garden edge.
    c.poly([(-0.02, 0.9), (1.02, 0.88), (1.02, 1.02), (-0.02, 1.02)], hexrgb('#c79a6c'))
    for i in range(12):
        x = i / 11
        c.poly([(x - 0.04, 0.9 - 0.02 * x), (x + 0.04, 0.9 - 0.02 * x), (x + 0.04, 0.905 - 0.02 * x), (x - 0.04, 0.905 - 0.02 * x)], hexrgb('#b8875a'))
    return c


def fruit_bowl():
    c = Canvas(1100, 1100, [(0, '#f3e6cf'), (0.62, '#efdcbc'), (0.62, '#b98a5e'), (1, '#a37450')])
    # Table cloth.
    c.poly([(0.1, 0.66), (0.9, 0.66), (0.98, 1.02), (0.02, 1.02)], hexrgb('#e9eef2'))
    for i in range(9):
        x = 0.1 + i * 0.1
        c.poly([(x - 0.01, 0.66), (x + 0.01, 0.66), (x + 0.012 + (x - 0.5) * 0.18, 1.02), (x - 0.012 + (x - 0.5) * 0.18, 1.02)], hexrgb('#9fc1d6', 160))
    # Fruit, back to front, heaped above the bowl's rim.
    c.ellipse(0.39, 0.45, 0.1, 0.1, hexrgb('#f29e38'))  # orange
    c.ellipse(0.36, 0.42, 0.025, 0.018, hexrgb('#f7c27a'))
    c.ellipse(0.61, 0.44, 0.095, 0.115, hexrgb('#f2c53d'))  # mango
    c.ellipse(0.64, 0.4, 0.045, 0.055, hexrgb('#8fb84a', 200), blur=0.02)
    rnd = random.Random(5)
    for k in range(22):  # grapes
        c.ellipse(0.25 + rnd.random() * 0.12, 0.47 + rnd.random() * 0.08, 0.028, 0.028, hexrgb(rnd.choice(['#7fae5a', '#8fbb66', '#6f9e4d'])))
    # Bananas as curved bands lying across the top.
    for off, col in [(0, '#f6d44c'), (0.035, '#f0c93d')]:
        pts = []
        for i in range(21):
            t = i / 20
            a = math.pi * (1.1 + 0.8 * t)
            pts.append((0.5 + 0.2 * math.cos(a), 0.47 + off + 0.12 * math.sin(a)))
        for i in range(20, -1, -1):
            t = i / 20
            a = math.pi * (1.1 + 0.8 * t)
            pts.append((0.5 + 0.18 * math.cos(a), 0.5 + off + 0.09 * math.sin(a)))
        c.poly(pts, hexrgb(col))
    # The bowl.
    pts = []
    for i in range(41):
        a = math.pi * i / 40
        pts.append((0.5 + 0.3 * math.cos(a), 0.56 + 0.16 * math.sin(a)))
    c.poly(pts, hexrgb('#4f8fa6'))
    c.ellipse(0.5, 0.56, 0.3, 0.035, hexrgb('#6fb0c4'))
    c.poly([(0.42, 0.715), (0.58, 0.715), (0.6, 0.745), (0.4, 0.745)], hexrgb('#3f7a8f'))
    for i in range(3):
        c.poly([(0.3 + i * 0.13, 0.63), (0.36 + i * 0.13, 0.63), (0.35 + i * 0.13, 0.64), (0.31 + i * 0.13, 0.64)], hexrgb('#f3f0e3', 200))
    return c


def train_window():
    c = Canvas(900, 1200, [(0, '#9ccbe6'), (0.5, '#dcecef'), (1, '#dcecef')])
    # Outside: fields, a line of trees, poles.
    c.ridge(0.55, 0.01, hexrgb('#9cbf86'), [(1, 1.2, 0.2)])
    c.ridge(0.62, 0.008, hexrgb('#b8cf7a'), [(1, 2.0, 0.6)])
    c.ridge(0.7, 0.006, hexrgb('#d9c77a'), [(1, 1.5, 0.3)])
    c.ridge(0.8, 0.006, hexrgb('#a9c36e'), [(1, 1.0, 0.8)])
    for x, hgt in [(0.15, 0.1), (0.24, 0.08), (0.33, 0.11), (0.62, 0.09), (0.7, 0.12), (0.8, 0.08)]:
        c.tree(x, 0.56, hgt, hexrgb('#5f9460'), hexrgb('#6b5a44'))
    for x in (0.45, 0.9):
        c.poly([(x - 0.004, 0.62), (x + 0.004, 0.62), (x + 0.003, 0.4), (x - 0.003, 0.4)], hexrgb('#6d6a66'))
        c.poly([(x - 0.03, 0.41), (x + 0.03, 0.41), (x + 0.03, 0.415), (x - 0.03, 0.415)], hexrgb('#6d6a66'))
    c.poly([(0.0, 0.405), (0.45, 0.415), (0.9, 0.41), (1.0, 0.405), (1.0, 0.407), (0.9, 0.412), (0.45, 0.417), (0.0, 0.407)], hexrgb('#6d6a66', 180))
    for cx, cy in [(0.3, 0.15), (0.7, 0.2)]:
        for dx, dy, r in [(0, 0, 0.08), (0.06, 0.01, 0.06), (-0.06, 0.015, 0.05)]:
            c.ellipse(cx + dx, cy + dy, r, r * 0.5, hexrgb('#ffffff', 220))
    # The window frame and horizontal bars, painted.
    frame = hexrgb('#3f6b73')
    c.poly([(-0.02, -0.02), (1.02, -0.02), (1.02, 0.08), (-0.02, 0.08)], frame)
    c.poly([(-0.02, 0.86), (1.02, 0.86), (1.02, 1.02), (-0.02, 1.02)], frame)
    c.poly([(-0.02, -0.02), (0.08, -0.02), (0.08, 1.02), (-0.02, 1.02)], frame)
    c.poly([(0.92, -0.02), (1.02, -0.02), (1.02, 1.02), (0.92, 1.02)], frame)
    for k in range(5):
        y = 0.22 + k * 0.13
        c.poly([(0.08, y), (0.92, y), (0.92, y + 0.016), (0.08, y + 0.016)], hexrgb('#5b8a91'))
        c.poly([(0.08, y + 0.016), (0.92, y + 0.016), (0.92, y + 0.02), (0.08, y + 0.02)], hexrgb('#2f5158'))
    c.poly([(0.0, 0.86), (1.0, 0.86), (1.0, 0.875), (0.0, 0.875)], hexrgb('#6f9aa1'))
    return c


def hills_mist():
    c = Canvas(1200, 900, [(0, '#c9dde3'), (0.5, '#e8efec'), (1, '#e8efec')])
    layers = [
        (0.35, '#9fb9b6', [(1, 1.2, 0.1), (0.5, 3.0, 0.4)]),
        (0.45, '#7fa39b', [(1, 1.6, 0.7), (0.4, 3.7, 0.2)]),
        (0.57, '#5f8b7c', [(1, 1.0, 0.35), (0.5, 2.6, 0.8)]),
        (0.7, '#467462', [(1, 1.4, 0.6), (0.3, 4.1, 0.1)]),
        (0.84, '#355f4e', [(1, 0.8, 0.9), (0.4, 2.2, 0.5)]),
    ]
    for k, (base, col, waves) in enumerate(layers):
        c.ridge(base, 0.07, hexrgb(col), waves)
        # A soft band of mist settling in front of each ridge.
        c.ridge(base + 0.05, 0.02, hexrgb('#f4f7f5', 150 - k * 15), [(1, 0.7, 0.2 + k * 0.1)], blur=0.04, bottom=base + 0.12)
    rnd = random.Random(9)
    for k in range(40):
        x = rnd.random()
        g = 0.86 + rnd.random() * 0.12
        hgt = 0.05 + rnd.random() * 0.05
        c.poly([(x - 0.012, g), (x + 0.012, g), (x, g - hgt)], hexrgb('#294b3e'))
    return c


def bamboo_grove():
    c = Canvas(900, 1200, [(0, '#eef4de'), (0.7, '#dfeccb'), (1, '#cfdcb4')])
    rnd = random.Random(12)
    for depth, col, node, count in [(0, '#b8d19a', '#a3bf85', 8), (1, '#8fb36d', '#789d58', 7), (2, '#5f8f45', '#4d7a37', 5)]:
        for k in range(count):
            x = rnd.random()
            wdt = 0.012 + depth * 0.008
            lean = (rnd.random() - 0.5) * 0.04
            c.poly([(x - wdt, 1.02), (x + wdt, 1.02), (x + lean + wdt * 0.8, -0.02), (x + lean - wdt * 0.8, -0.02)], hexrgb(col))
            y = 0.95
            while y > 0:
                xx = x + lean * (1 - y)
                c.poly([(xx - wdt * 1.1, y), (xx + wdt * 1.1, y), (xx + wdt * 1.1, y - 0.008), (xx - wdt * 1.1, y - 0.008)], hexrgb(node))
                if rnd.random() < 0.45:
                    s = rnd.choice((-1, 1))
                    for j in range(3):
                        ly = y - 0.01 - j * 0.02
                        c.poly([(xx, ly), (xx + s * 0.05, ly - 0.02 + j * 0.01), (xx + s * 0.12, ly - 0.005 + j * 0.02), (xx + s * 0.05, ly + 0.004)], hexrgb(node))
                y -= 0.12 + rnd.random() * 0.04
    # Light through the grove.
    c.glow(0.5, 0.2, 0.2, hexrgb('#fffbe6'), 0.8)
    return c


def paddy_fields():
    c = Canvas(1200, 675, [(0, '#a8cfe3'), (0.45, '#e7f1ea'), (1, '#e7f1ea')])
    c.ridge(0.38, 0.05, hexrgb('#8fb0a3'), [(1, 1.1, 0.4), (0.4, 2.9, 0.1)])
    c.ridge(0.44, 0.03, hexrgb('#6f9a86'), [(1, 1.7, 0.2), (0.3, 4.0, 0.6)])
    for x in [0.08, 0.15, 0.3, 0.72, 0.8, 0.9]:
        c.tree(x, 0.48, 0.08, hexrgb('#4f7f58'), hexrgb('#5d4a38'))
    # Paddy plots with water reflections, separated by low bunds.
    rows = [(0.48, 0.56), (0.56, 0.66), (0.66, 0.8), (0.8, 1.02)]
    greens = ['#b7d66f', '#9cc95a', '#a9d46a', '#8dbd4c']
    for (top, bot), g in zip(rows, greens):
        c.poly([(-0.02, top), (1.02, top), (1.02, bot), (-0.02, bot)], hexrgb(g))
        rnd = random.Random(int(top * 100))
        for k in range(int(60 * (bot - top) / 0.1)):
            x = rnd.random()
            y = top + 0.01 + rnd.random() * (bot - top - 0.02)
            hgt = 0.012 + (y - 0.48) * 0.04
            c.poly([(x - 0.002, y), (x + 0.002, y), (x + 0.004, y - hgt), (x - 0.001, y - hgt)], hexrgb('#6a9a3c'))
        for k in range(4):  # glints of water between the rows of seedlings
            gx = rnd.random() * 0.8 + 0.1
            gy = top + (k + 0.5) / 4 * (bot - top)
            c.poly([(gx - 0.05, gy), (gx + 0.05, gy), (gx + 0.045, gy + 0.003), (gx - 0.045, gy + 0.003)], hexrgb('#e6f3f4', 170))
        c.poly([(-0.02, top - 0.004), (1.02, top - 0.004), (1.02, top + 0.006), (-0.02, top + 0.006)], hexrgb('#8a7a52'))
    return c


PICTURES = {
    'everyday-home': {
        'pic-river-dusk': river_dusk,
        'pic-hills-morning': hills_morning,
        'pic-seaside': seaside,
        'pic-flowers': flowers,
        'pic-fruit-bowl': fruit_bowl,
        'pic-train-window': train_window,
    },
    'northeast-home': {
        'pic-hills-mist': hills_mist,
        'pic-bamboo-grove': bamboo_grove,
        'pic-paddy-fields': paddy_fields,
    },
}


def main():
    only = set(sys.argv[1:])
    for pack, pics in PICTURES.items():
        out_dir = os.path.join(PACKS, pack, 'images')
        os.makedirs(out_dir, exist_ok=True)
        for pid, draw in pics.items():
            if only and pid not in only:
                continue
            path = os.path.join(out_dir, pid + '.webp')
            size, (w, h), q = draw().save(path)
            print(f'{pack}/{pid}: {w}x{h} {size / 1024:.1f} KB (quality {q})')


if __name__ == '__main__':
    main()
