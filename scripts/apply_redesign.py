#!/usr/bin/env python3
"""Site-wide redesign wiring:
1. Evolve the brand palette (old hexes -> new premium palette) in all HTML/JS.
2. Inject <link rel="stylesheet" href="/style.css" /> before </head> on pages
   that don't already reference the stylesheet.
"""
import glob, re, os

# ── palette map: old -> new (longest first to avoid partial overlaps) ──
REPL = [
    ('rgba(26, 123, 107,', 'rgba(14, 124, 104,'),
    ('rgba(241, 196, 15,', 'rgba(224, 166, 46,'),
    ('rgba(11, 42, 59,', 'rgba(11, 33, 56,'),
    ('rgba(26, 75, 94,', 'rgba(22, 51, 79,'),
    ('rgba(11,26,42,', 'rgba(8,16,26,'),
    ('#1a7b6b', '#0e7c68'),
    ('#0f4f43', '#0a5a4a'),
    ('#e8f5f0', '#e6f4ef'),
    ('#0b2a3b', '#0b2138'),
    ('#1a4b5e', '#16334f'),
    ('#1a4055', '#16334f'),
    ('#f1c40f', '#e0a62e'),
    ('#e0b50e', '#c8901f'),
    ('#f0f4f8', '#f5f8fa'),
    ('#6a889a', '#698093'),
    ('#2c5a6b', '#33475b'),
    ('#1a3340', '#33475b'),
    ('#1a3a2a', '#0c1a2a'),
    ('#2f5547', '#33475b'),
    ('#1a4a2a', '#0a5a4a'),
    ('#e2eee0', '#e7edf3'),
    ('#dce3e9', '#d3dce5'),
    ('#b4d0e0', '#a9c3d6'),
    ('#cde9df', '#cfe9e0'),
    ('#eef7f3', '#f0f8f5'),
    ('#14815f', '#0e7c68'),
    ('#2ecc9a', '#0e7c68'),
    ('#e67e22', '#e0a62e'),
    ('#f39c12', '#e0a62e'),
    ('#f5f7f4', '#f5f8fa'),
    ('#1e293b', '#0b2138'),
]

def sweep(text):
    for old, new in REPL:
        text = text.replace(old, new)
    return text

# ── 1) palette sweep over root HTML + JS ──
targets = sorted(glob.glob('*.html')) + sorted(glob.glob('*.js'))
changed = []
for path in targets:
    with open(path, encoding='utf-8', errors='replace') as f:
        orig = f.read()
    new = sweep(orig)
    if new != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new)
        changed.append(path)

print(f'Palette-swept {len(changed)} files: {", ".join(changed)}')

# ── 2) inject stylesheet link ──
injected = []
for path in sorted(glob.glob('*.html')):
    with open(path, encoding='utf-8', errors='replace') as f:
        html = f.read()
    if re.search(r'<link[^>]+href=["\']/?style\.css', html):
        continue
    link = '    <link rel="stylesheet" href="/style.css" />\n'
    if '</head>' in html:
        html = html.replace('</head>', link + '</head>', 1)
    else:
        html += '\n' + link
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    injected.append(path)

print(f'Injected stylesheet link into {len(injected)} files: {", ".join(injected)}')

# ── 3) manifest theme ──
with open('manifest.json', encoding='utf-8') as f:
    m = f.read()
m = m.replace('"theme_color": "#1a7b6b"', '"theme_color": "#0b2138"')
m = m.replace('"background_color": "#0b2a3b"', '"background_color": "#0b2138"')
with open('manifest.json', 'w', encoding='utf-8') as f:
    f.write(m)
print('manifest.json updated')

# ── 4) sw.js cache bump ──
with open('sw.js', encoding='utf-8') as f:
    sw = f.read()
sw = sw.replace("const CACHE_VERSION = 'pse-v2';", "const CACHE_VERSION = 'pse-v3';")
with open('sw.js', 'w', encoding='utf-8') as f:
    f.write(sw)
print('sw.js cache version bumped')
