#!/usr/bin/env python3
"""Add photographed, interactive objects and cropped thumbnails to the asset manifest."""
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[3] / 'public' / 'suite' / 'assets'
MANIFEST = ROOT / 'manifest.json'
SOURCES = {p['name']: p for p in json.loads((ROOT / 'panoramas/sources.json').read_text())['panoramas']}

# id, room, UV, category, mount, size, label, short factual description
ITEMS = [
 ('lythwood-television','lythwood-room',.724,.545,'music-media','floor',[.8,1.17,.55],'Television','A television in the photographed room.'),
 ('lythwood-lamp','lythwood-room',.366,.541,'lighting','surface',[.3,.45,.3],'Table lamp','A lamp on the dressing table.'),
 ('lythwood-mirror','lythwood-room',.336,.532,'decor','wall',[.51,.71,.04],'Mirror','A mirror above the dressing table.'),
 ('lythwood-picture','lythwood-room',.835,.438,'decor','wall',[.3,.38,.025],'Framed picture','A framed picture on the wall.'),
 ('lythwood-tea-table','lythwood-room',.718,.662,'furniture','floor',[1,.42,.55],'Tea table','A table with a tea tray and cups.'),
 ('combination-sofa','combination-room',.285,.675,'furniture','floor',[2.1,.9,.9],'Sofa','An upholstered sofa in the sitting room.'),
 ('combination-lamp','combination-room',.435,.61,'lighting','floor',[.55,1.6,.55],'Standing lamp','A standing lamp beside the sofa.'),
 ('combination-armchair','combination-room',.885,.68,'furniture','floor',[.85,1,.85],'Armchair','An upholstered armchair beside a small table.'),
 ('combination-picture','combination-room',.365,.45,'decor','wall',[.7,.55,.08],'Framed landscape','A landscape picture on the wall.'),
 ('kiara-sofa','kiara-interior',.62,.59,'furniture','floor',[2.1,.95,.9],'Sofa','A sofa in the photographed lounge.'),
 ('kiara-television','kiara-interior',.277,.51,'music-media','floor',[.8,1.17,.55],'Television','A television beside the doorway.'),
 ('kiara-fridge','kiara-interior',.821,.52,'storage','floor',[.9,1.9,.8],'Refrigerator','A refrigerator beside the kitchen.'),
 ('kiara-chair','kiara-interior',.115,.59,'furniture','floor',[.85,1,.85],'Chair','A chair at the kitchen counter.'),
 ('kiara-mug','kiara-interior',.66,.715,'kitchen-food','surface',[.12,.12,.12],'Mug','A mug on the table in front of the camera.'),
 ('garden-pond','chinese-garden',.53,.64,'plants-outdoor','floor',[2.0,.5,2.0],'Garden pond','A pond and stone fountain in a photographed Chinese garden.'),
 ('garden-pavilion','chinese-garden',.76,.50,'community','wall',[1.5,2.0,.2],'Garden pavilion','A traditional pavilion beside the garden pond.'),
 ('garden-trees','chinese-garden',.12,.31,'plants-outdoor','wall',[1.5,2.0,.2],'Garden trees','Trees and leafy canopy around the garden.'),
 ('park-lawn','green-point-park',.50,.68,'plants-outdoor','floor',[2.0,.5,2.0],'Open park lawn','Open grass in Green Point Park.'),
 ('park-mountains','green-point-park',.82,.46,'travel','wall',[1.5,1.0,.1],'Distant mountains','Mountains on the horizon beyond Cape Town.'),
 ('beach-shore','mondello-beach',.52,.66,'travel','floor',[2.0,.5,2.0],'Sandy shoreline','Sunlit sand at Mondello Beach in Sicily.'),
 ('beach-water','mondello-beach',.30,.53,'travel','wall',[1.5,1.0,.1],'Sea','Clear water along the Mediterranean coast.'),
 ('beach-pines','mondello-beach',.74,.42,'plants-outdoor','wall',[1.5,1.0,.1],'Coastal pines','Umbrella pines behind the beach.'),
]

HINDI = {
 'Television': 'टेलीविज़न', 'Table lamp': 'मेज़ का लैंप', 'Mirror': 'आईना',
 'Framed picture': 'फ़्रेम में चित्र', 'Tea table': 'चाय की मेज़', 'Sofa': 'सोफ़ा',
 'Standing lamp': 'खड़ा लैंप', 'Armchair': 'आरामकुर्सी', 'Framed landscape': 'फ़्रेम में प्राकृतिक दृश्य',
 'Refrigerator': 'फ़्रिज', 'Chair': 'कुर्सी', 'Mug': 'मग', 'Garden pond': 'बगीचे का तालाब',
 'Garden pavilion': 'बगीचे का मंडप', 'Garden trees': 'बगीचे के पेड़', 'Open park lawn': 'पार्क का खुला मैदान',
 'Distant mountains': 'दूर के पहाड़', 'Sandy shoreline': 'रेतीला किनारा', 'Sea': 'समुद्र', 'Coastal pines': 'तटीय चीड़ के पेड़'
}

manifest = json.loads(MANIFEST.read_text())
manifest['assets'] = [a for a in manifest['assets'] if not (a.get('source') or {}).get('kind') == 'photograph']
thumb_dir = ROOT / 'thumbs'
thumb_dir.mkdir(exist_ok=True)
for ident, room, u, v, category, mount, size, label, description in ITEMS:
    src = SOURCES[room]
    photo = Image.open(ROOT / src['files']['display']['file']).convert('RGB')
    w, h = photo.size
    # Crop the real object, with some of its surroundings for orientation.
    half_w, half_h = int(w * .048), int(h * .09)
    x, y = int(u * w), int(v * h)
    box = (max(0, x-half_w), max(0, y-half_h), min(w, x+half_w), min(h, y+half_h))
    thumbnail = f'thumbs/{ident}.webp'
    ImageOps.fit(photo.crop(box), (256, 256), method=Image.Resampling.LANCZOS).save(thumb_dir / f'{ident}.webp', 'WEBP', quality=82)
    manifest['assets'].append({
      'id': ident, 'category': category, 'mount': mount, 'source': {'kind': 'photograph'},
      'thumbnail': thumbnail, 'label': {'en': label, 'hi': HINDI[label]},
      'description': {'en': description, 'hi': f'तस्वीर में {HINDI[label]}।'},
      'size': size, 'collision': False, 'activities': ['space','object','sequence'],
      'provenance': {'source': 'Poly Haven', 'author': ', '.join(src['authors']), 'license': 'CC0-1.0',
                     'url': src['page'], 'attribution': f"{src['title']} by {', '.join(src['authors'])}, Poly Haven, CC0 1.0.",
                     'retrieved': src['retrieved'], 'modified': 'Hotspot and thumbnail identified in the original photograph'},
      'budget': {'triangles': 2, 'textureKB': 0}
    })
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
room_thumbs = ROOT.parent / 'packs' / 'everyday-home' / 'thumbs'
room_thumbs.mkdir(exist_ok=True)
for room, centre in [('lythwood-room', .72), ('combination-room', .30), ('kiara-interior', .62),
                     ('chinese-garden', .53), ('green-point-park', .5), ('mondello-beach', .5)]:
    photo = Image.open(ROOT / SOURCES[room]['files']['display']['file']).convert('RGB')
    w, h = photo.size
    cx = int(centre * w)
    crop = photo.crop((max(0, cx - int(w*.14)), int(h*.31), min(w, cx + int(w*.14)), int(h*.70)))
    ImageOps.fit(crop, (640, 360), method=Image.Resampling.LANCZOS).save(room_thumbs / f'{room}.webp', 'WEBP', quality=82)
print(f'Wrote {len(ITEMS)} photographed objects and thumbnails')
