#!/usr/bin/env python3
"""Construit les deux paquets de DevDocTrad.

Utilisation (une seule commande, depuis la racine du dépôt) :

    python3 build.py

Ce que fait le script :
1. vide le dossier dist/ ;
2. copie src/ dans dist/chrome et dist/firefox ;
3. écrit dans chaque dossier un manifest.json = manifests/base.json + manifests/<navigateur>.json ;
4. ajoute le fichier LICENSE ;
5. crée dist/chrome.zip et dist/firefox.zip (fichiers triés, dates fixes : même source = même zip) ;
6. affiche l'empreinte SHA-256 de chaque zip, pour vérifier que la version livrée est celle testée ;
7. copie les deux zips dans release/ (devdoctrad-<navigateur>-<version>.zip) avec SHA256SUMS.txt.

Pour les tests : `python3 build.py --dist DOSSIER` construit dans DOSSIER (vidé d'abord)
sans toucher à dist/ ni à release/.

Aucune dépendance : Python 3.8 ou plus récent suffit.
"""
import hashlib
import json
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
DIST = ROOT / "dist"
TARGETS = ("chrome", "firefox")
FIXED_DATE = (2026, 1, 1, 0, 0, 0)


def merge(a, b):
    """Fusionne deux manifestes. Les permissions s'ajoutent (« tts » seulement pour Chrome : Firefox
    n'a pas browser.tts et signalerait une permission inconnue) ; les autres listes sont remplacées."""
    out = dict(a)
    for k, v in b.items():
        if k == "permissions" and isinstance(v, list) and isinstance(out.get(k), list):
            out[k] = out[k] + [p for p in v if p not in out[k]]
        elif isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = merge(out[k], v)
        else:
            out[k] = v
    return out


def build(target):
    base = json.loads((ROOT / "manifests" / "base.json").read_text(encoding="utf-8"))
    extra = json.loads((ROOT / "manifests" / f"{target}.json").read_text(encoding="utf-8"))
    manifest = merge(base, extra)
    out = DIST / target
    shutil.copytree(SRC, out)
    shutil.copy(ROOT / "LICENSE", out / "LICENSE")
    (out / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for f in manifest.get("background", {}).get("scripts", []) + [manifest.get("background", {}).get("service_worker", "")]:
        if f and not (out / f).exists():
            sys.exit(f"Fichier manquant dans {target} : {f}")
    zpath = DIST / f"{target}.zip"
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(out.rglob("*")):
            if p.is_file():
                info = zipfile.ZipInfo(p.relative_to(out).as_posix(), FIXED_DATE)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                z.writestr(info, p.read_bytes())
    digest = hashlib.sha256(zpath.read_bytes()).hexdigest()
    try:
        shown = zpath.relative_to(ROOT)
    except ValueError:
        shown = zpath
    print(f"{shown}  {zpath.stat().st_size // 1024} Ko  sha256 {digest}")
    return digest


def main():
    global DIST
    only_dist = "--dist" in sys.argv
    if only_dist:
        DIST = Path(sys.argv[sys.argv.index("--dist") + 1]).resolve()
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)
    version = json.loads((ROOT / "manifests" / "base.json").read_text(encoding="utf-8"))["version"]
    print(f"DevDocTrad {version}")
    if only_dist:
        for t in TARGETS:
            build(t)
        return
    release = ROOT / "release"
    release.mkdir(exist_ok=True)
    for old in release.glob("devdoctrad-*.zip"):
        old.unlink()
    sums = []
    for t in TARGETS:
        digest = build(t)
        name = f"devdoctrad-{t}-{version}.zip"
        shutil.copy(DIST / f"{t}.zip", release / name)
        sums.append(f"{digest}  {name}")
    (release / "SHA256SUMS.txt").write_text("\n".join(sums) + "\n", encoding="utf-8")
    print(f"Copies prêtes à télécharger dans release/ (empreintes dans release/SHA256SUMS.txt)")


if __name__ == "__main__":
    main()
