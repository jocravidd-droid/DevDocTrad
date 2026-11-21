#!/usr/bin/env python3
"""Dessine l'icône de DevDocTrad (carré arrondi dégradé, chevrons de code et flèche de traduction).

Produit src/icons/icon-{16,32,48,128}.png, store/icon-128.png (128 px avec marge de 16 px,
format demandé par le Chrome Web Store) et docs/assets/icon-512.png.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
S = 1024  # dessin en grand puis réduction (bords lisses)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))


def master(size=S, pad=0):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = size - 2 * pad
    # dégradé diagonal bleu -> indigo -> violet
    grad = Image.new("RGBA", (inner, inner))
    px = grad.load()
    c1, c2, c3 = (10, 132, 255, 255), (94, 92, 230, 255), (191, 90, 242, 255)
    for y in range(inner):
        for x in range(inner):
            t = (x + y) / (2 * inner)
            px[x, y] = lerp(c1, c2, t / 0.6) if t < 0.6 else lerp(c2, c3, (t - 0.6) / 0.4)
    mask = Image.new("L", (inner, inner), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, inner - 1, inner - 1), radius=int(inner * 0.23), fill=255)
    img.paste(grad, (pad, pad), mask)

    # reflet de verre en haut
    gloss = Image.new("RGBA", (inner, inner), (0, 0, 0, 0))
    gd = ImageDraw.Draw(gloss)
    gd.ellipse((-inner * 0.3, -inner * 0.75, inner * 1.3, inner * 0.45), fill=(255, 255, 255, 52))
    gloss = gloss.filter(ImageFilter.GaussianBlur(inner * 0.025))
    gloss = Image.composite(gloss, Image.new("RGBA", (inner, inner), (0, 0, 0, 0)), mask)
    img.alpha_composite(gloss, (pad, pad))

    d = ImageDraw.Draw(img)
    w = int(inner * 0.085)
    cx, cy = pad + inner / 2, pad + inner / 2
    white = (255, 255, 255, 255)
    # chevrons < >
    h = inner * 0.20
    lx = cx - inner * 0.30
    rx = cx + inner * 0.30
    top = cy - inner * 0.06
    d.line([(lx + h * 0.75, top - h), (lx, top), (lx + h * 0.75, top + h)], fill=white, width=w, joint="curve")
    d.line([(rx - h * 0.75, top - h), (rx, top), (rx - h * 0.75, top + h)], fill=white, width=w, joint="curve")
    for (x, y) in [(lx + h * 0.75, top - h), (lx + h * 0.75, top + h), (rx - h * 0.75, top - h), (rx - h * 0.75, top + h), (lx, top), (rx, top)]:
        d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=white)
    # barre oblique
    d.line([(cx + inner * 0.06, top - h * 1.05), (cx - inner * 0.06, top + h * 1.05)], fill=white, width=w)
    for (x, y) in [(cx + inner * 0.06, top - h * 1.05), (cx - inner * 0.06, top + h * 1.05)]:
        d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=white)
    # flèche de traduction (deux lignes de texte reliées)
    by = cy + inner * 0.27
    bw = int(inner * 0.055)
    d.rounded_rectangle((cx - inner * 0.28, by - bw / 2, cx - inner * 0.05, by + bw / 2), radius=bw / 2, fill=(255, 255, 255, 200))
    d.rounded_rectangle((cx + inner * 0.05, by - bw / 2, cx + inner * 0.28, by + bw / 2), radius=bw / 2, fill=white)
    ax = cx
    d.polygon([(ax - inner * 0.03, by - inner * 0.045), (ax + inner * 0.035, by), (ax - inner * 0.03, by + inner * 0.045)], fill=white)
    return img


def save(img, size, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    out = img.resize((size, size), Image.LANCZOS)
    if size <= 32:
        out = out.filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=0))
    out.save(path)
    print(path.relative_to(ROOT), out.size)


m = master()
for s in (16, 32, 48, 128):
    save(m, s, ROOT / "src" / "icons" / f"icon-{s}.png")
save(m, 512, ROOT / "docs" / "assets" / "icon-512.png")
save(m, 180, ROOT / "docs" / "assets" / "apple-touch-icon.png")
save(m, 32, ROOT / "docs" / "assets" / "favicon-32.png")
# Chrome Web Store : 128 x 128 avec 96 x 96 d'image et 16 px de marge transparente
store = master(S, pad=S // 8)
save(store, 128, ROOT / "store" / "icon-128.png")
