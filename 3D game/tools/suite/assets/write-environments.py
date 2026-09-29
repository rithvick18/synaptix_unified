#!/usr/bin/env python3
"""Writes public/suite/packs/*/environments.json (the environment dressing presets).

Each placement is checked here against the shell's slot (mount and maxSize) before the file
is written; buildSuiteScene checks the same rules again at runtime.
"""
import json, os, re, sys
ROOT = os.path.join(os.path.dirname(__file__), '..', '..', '..')
man = {a['id']: a for a in json.load(open(os.path.join(ROOT, 'public/suite/assets/manifest.json')))['assets']}

def slots(shell):
    src = open(os.path.join(ROOT, f'src/suite/environments/shells/{shell}.ts')).read()
    out = {}
    for m in re.finditer(r"onCounter\('([^']+)', [-\d.]+, ([\d.]+)\)", src):
        out[m.group(1)] = ('surface', [float(m.group(2)), 0.5, 0.45])
    for m in re.finditer(r"\{ id: '([^']+)', mount: '(\w+)'.*?maxSize: \[([^\]]+)\]", src):
        out[m.group(1)] = (m.group(2), [float(v) for v in m.group(3).split(',')])
    return out

def env(id, shell, name, desc, materials, rows):
    sl = slots(shell); seen = set(); placements = []
    for row in rows:
        pid, asset, slot = row[:3]; extra = row[3] if len(row) > 3 else {}
        a = man[asset]; mount, maxs = sl[slot]
        assert pid not in seen, pid; seen.add(pid)
        assert a['mount'] == mount, f'{id}/{pid}: {asset} is {a["mount"]}, slot {slot} is {mount}'
        assert all(s <= m + 1e-6 for s, m in zip(a['size'], maxs)), f'{id}/{pid}: {asset} {a["size"]} > {slot} {maxs}'
        placements.append({'id': pid, 'asset': asset, 'slot': slot, **extra})
    photo_thumbs = {'photoLivingDemo': 'lythwood-room', 'photoCombination': 'combination-room', 'photoKiara': 'kiara-interior',
                    'photoChineseGarden': 'chinese-garden', 'photoGreenPointPark': 'green-point-park', 'photoMondelloBeach': 'mondello-beach'}
    thumbnail = {'thumbnail': f'thumbs/{photo_thumbs[shell]}.webp'} if shell in photo_thumbs else {}
    return {'id': id, 'shell': shell, 'name': name, 'description': desc, **thumbnail, 'materials': materials, 'placements': placements}

H = {'highlight': True}
def img(i, hl=False): return {'image': i, **({'highlight': True} if hl else {})}

LIVING = lambda frames, centreLeft, frontRight, rug, extra_hl: [
    ('sofa', 'sofa-wood', 'sofa'),
    ('photo-album', 'photo-album', 'sofa-seat', H),
    ('frame-large', 'frame-wall-large', 'above-sofa', img(frames[0], True)),
    ('frame-left', 'frame-wall-small', 'above-sofa-left', img(frames[1])),
    ('frame-right', 'frame-wall-small', 'above-sofa-right', img(frames[2])),
    ('almirah', 'almirah-steel', 'back-left'),
    ('clock', 'clock-wall', 'back-left-high', H),
    ('bookshelf', 'bookshelf', 'back-right'),
    ('harmonium', 'harmonium', 'back-gap-right', H),
    ('rug', rug, 'rug'),
    ('coffee-table', 'coffee-table', 'centre'),
    ('centre-left', centreLeft, 'centre-top-left', extra_hl),
    ('newspaper', 'newspaper-folded', 'centre-top-right'),
    ('armchair', 'armchair-cane', 'armchair-left'),
    ('side-table', 'side-table', 'side-left'),
    ('frame-table', 'frame-table', 'side-left-top'),
    ('calendar', 'calendar-wall', 'left-wall-front'),
    ('sewing-machine', 'sewing-machine', 'left-floor-front', H),
    ('trunk', 'trunk-tin', 'right-mid'),
    ('frame-high', 'frame-wall-small', 'right-wall-high'),
    ('mirror', 'wall-mirror', 'right-wall-front'),
    ('suitcase', 'suitcase-old', 'front-left'),
    ('kite', 'kite-spool', 'front-wall-left'),
    ('front-right', frontRight, 'front-right'),
    ('ceiling-fan', 'ceiling-fan', 'ceiling'),
]

everyday = [
    env('living-room', 'livingRoom', {'en': 'Living room', 'hi': 'बैठक'},
        {'en': 'A sitting room with a sofa, family photographs, a clock, a radio and a few keepsakes.',
         'hi': 'सोफ़ा, पारिवारिक तस्वीरों, घड़ी, रेडियो और कुछ यादगार चीज़ों वाला बैठक का कमरा।'},
        {'wall': '#efe4d2', 'trim': '#8a6a4a', 'floor': 'terrazzo', 'light': 'warm'},
        LIVING(['pic-river-dusk', 'pic-flowers', 'pic-hills-morning'], 'radio-transistor', 'cricket-bat-ball', 'rug-durrie', H)),
    env('kitchen-dining', 'kitchenDining', {'en': 'Kitchen and dining area', 'hi': 'रसोई और खाने की जगह'},
        {'en': 'A kitchen with a cooking platform, everyday utensils and a dining table set for a meal.',
         'hi': 'खाना बनाने के चबूतरे, रोज़ के बर्तनों और भोजन के लिए सजी मेज़ वाली रसोई।'},
        {'wall': '#f1ede4', 'trim': '#6f7a70', 'floor': 'tile', 'light': 'neutral'},
        [('gas-stove', 'gas-stove', 'counter-stove'),
         ('pressure-cooker', 'pressure-cooker', 'counter-2', H),
         ('spice-box', 'spice-box', 'counter-3', H),
         ('tumblers', 'steel-tumbler-set', 'counter-4'),
         ('rolling-board', 'rolling-board-pin', 'counter-5'),
         ('wall-shelf', 'wall-shelf', 'wall-above-stove'),
         ('kitchen-rack', 'kitchen-rack', 'wall-rack'),
         ('cupboard', 'cupboard-wood', 'back-right'),
         ('water-pot', 'clay-water-pot', 'pot-corner', H),
         ('calendar', 'calendar-wall', 'left-wall'),
         ('stool', 'stool-low', 'left-floor'),
         ('clock', 'clock-wall', 'left-wall-2'),
         ('plastic-chair', 'chair-plastic', 'left-floor-2'),
         ('dining-table', 'dining-table', 'dining'),
         ('table-cloth', 'table-cloth', 'dining-cloth'),
         ('plate', 'steel-plate', 'table-1'),
         ('tiffin', 'tiffin-carrier', 'table-2', H),
         ('pickle-jar', 'jar-pickle', 'table-3'),
         ('chair-1', 'chair-wood', 'chair-back-1'),
         ('chair-2', 'chair-wood', 'chair-back-2'),
         ('chair-3', 'chair-wood', 'chair-front-1'),
         ('chair-4', 'chair-wood', 'chair-front-2'),
         ('frame', 'frame-wall-small', 'right-wall', img('pic-fruit-bowl')),
         ('side-table', 'side-table', 'right-floor'),
         ('radio', 'radio-transistor', 'right-floor-top'),
         ('bucket', 'bucket-mug', 'front-floor'),
         ('frame-front', 'frame-wall-small', 'front-wall', img('pic-train-window')),
         ('ceiling-fan', 'ceiling-fan', 'ceiling')]),
    env('courtyard-veranda', 'courtyardVeranda', {'en': 'Courtyard and veranda', 'hi': 'आँगन और बरामदा'},
        {'en': 'An open courtyard with a covered veranda, plants, a bicycle and a place to sit.',
         'hi': 'ढके बरामदे, पौधों, साइकिल और बैठने की जगह वाला खुला आँगन।'},
        {'wall': '#eadcc3', 'trim': '#7a5a3a', 'floor': 'red-oxide', 'light': 'warm'},
        [('frame-large', 'frame-wall-large', 'house-wall-a', img('pic-seaside', True)),
         ('clock', 'clock-wall', 'house-wall-b'),
         ('kite', 'kite-spool', 'house-wall-c', H),
         ('mirror', 'wall-mirror', 'house-wall-d'),
         ('frame-small', 'frame-wall-small', 'house-wall-high'),
         ('bench', 'bench-veranda', 'veranda-bench'),
         ('newspaper', 'newspaper-folded', 'bench-top-left'),
         ('tumblers', 'steel-tumbler-set', 'bench-top-right'),
         ('side-table', 'side-table', 'veranda-right'),
         ('lantern', 'hurricane-lantern', 'veranda-right-top', H),
         ('armchair', 'armchair-cane', 'veranda-seat-left'),
         ('plastic-chair', 'chair-plastic', 'veranda-seat-right'),
         ('mat', 'floor-mat-woven', 'veranda-mat'),
         ('hanging-plant-1', 'hanging-plant', 'veranda-hang-left'),
         ('hanging-plant-2', 'hanging-plant', 'veranda-hang-right'),
         ('clothesline', 'clothesline', 'clothesline'),
         ('flower-pots', 'flower-pots-row', 'pots-front', H),
         ('big-plant', 'potted-plant-large', 'corner-front-right'),
         ('bicycle', 'bicycle', 'right-wall-floor', H),
         ('bucket', 'bucket-mug', 'tap-floor'),
         ('water-pot', 'clay-water-pot', 'left-wall-floor'),
         ('umbrella', 'umbrella', 'right-wall-hang'),
         ('calendar', 'calendar-wall', 'left-wall-hang'),
         ('carrom', 'carrom-board', 'courtyard-centre', H)]),
    # Objects are identified in the actual photograph; no 3D replicas cover its pixels.
    env('photo-living-demo', 'photoLivingDemo', {'en': 'Lythwood room · photographed', 'hi': 'लिथवुड का कमरा · तस्वीर'},
        {'en': 'Look around a real photographed room. Explore its television, lamp, mirror, picture and tea table.',
         'hi': 'एक असली कमरे की तस्वीर में चारों ओर देखें। टीवी, लैंप, आईना, चित्र और चाय की मेज़ देखें।'},
        {},
        [('television', 'lythwood-television', 'television', H),
         ('lamp', 'lythwood-lamp', 'lamp', H),
         ('mirror', 'lythwood-mirror', 'mirror'),
         ('picture', 'lythwood-picture', 'picture'),
         ('tea-table', 'lythwood-tea-table', 'tea-table', H)]),
    env('photo-combination', 'photoCombination', {'en': 'Traditional sitting room', 'hi': 'पारंपरिक बैठक'},
        {'en': 'A photographed sitting room with a sofa, armchair, standing lamp and framed art.',
         'hi': 'सोफ़े, आरामकुर्सी, लैंप और चित्रों वाली असली बैठक की तस्वीर।'}, {},
        [('sofa', 'combination-sofa', 'sofa', H), ('lamp', 'combination-lamp', 'lamp', H),
         ('armchair', 'combination-armchair', 'armchair', H), ('picture', 'combination-picture', 'picture')]),
    env('photo-kiara', 'photoKiara', {'en': 'Kitchen and lounge', 'hi': 'रसोई और बैठक'},
        {'en': 'A photographed home with a kitchen, sofa, table, television and everyday objects.',
         'hi': 'रसोई, सोफ़े, मेज़, टीवी और रोज़मर्रा की चीज़ों वाले असली घर की तस्वीर।'}, {},
        [('sofa', 'kiara-sofa', 'sofa', H), ('television', 'kiara-television', 'television', H),
         ('fridge', 'kiara-fridge', 'fridge', H), ('chair', 'kiara-chair', 'chair'),
         ('mug', 'kiara-mug', 'mug')]),
    env('photo-chinese-garden', 'photoChineseGarden', {'en': 'Chinese garden', 'hi': 'चीनी उद्यान'},
        {'en': 'A real 360° garden photograph with a pond, stone paths, trees and a pavilion.',
         'hi': 'तालाब, पत्थर के रास्तों, पेड़ों और मंडप वाले बगीचे की वास्तविक 360° तस्वीर।'}, {},
        [('pond', 'garden-pond', 'pond', H), ('pavilion', 'garden-pavilion', 'pavilion', H),
         ('garden-trees', 'garden-trees', 'garden-trees')]),
    env('photo-green-point-park', 'photoGreenPointPark', {'en': 'Green Point Park · Cape Town', 'hi': 'ग्रीन पॉइंट पार्क · केप टाउन'},
        {'en': 'A real 360° park photograph looking over open grass toward the city and mountains.',
         'hi': 'खुले मैदान से शहर और पहाड़ों की ओर देखता पार्क का वास्तविक 360° दृश्य।'}, {},
        [('park-lawn', 'park-lawn', 'lawn', H), ('park-mountains', 'park-mountains', 'mountains')]),
    env('photo-mondello-beach', 'photoMondelloBeach', {'en': 'Mondello Beach · Sicily', 'hi': 'मोंडेलो बीच · सिसिली'},
        {'en': 'A real 360° seaside photograph with sand, clear water and coastal trees.',
         'hi': 'रेत, साफ़ पानी और तटीय पेड़ों वाला समुद्र-तट का वास्तविक 360° दृश्य।'}, {},
        [('beach-shore', 'beach-shore', 'shore', H), ('beach-water', 'beach-water', 'water'),
         ('beach-pines', 'beach-pines', 'pines')]),
]

northeast = [
    env('ne-living-room', 'livingRoom', {'en': 'Living room (Northeast pack)', 'hi': 'बैठक (पूर्वोत्तर पैक)'},
        {'en': 'A sitting room with photographs and everyday things, a xorai on the low table and a bamboo basket.',
         'hi': 'तस्वीरों और रोज़ की चीज़ों वाला बैठक का कमरा, नीची मेज़ पर सराई और एक बाँस की टोकरी।'},
        {'wall': '#e6d8bd', 'trim': '#6b4f2e', 'floor': 'wood', 'light': 'warm'},
        LIVING(['pic-hills-mist', 'pic-bamboo-grove', 'pic-paddy-fields'], 'xorai', 'bamboo-basket', 'floor-mat-woven', H)),
    env('ne-veranda', 'courtyardVeranda', {'en': 'Veranda (Northeast pack)', 'hi': 'बरामदा (पूर्वोत्तर पैक)'},
        {'en': 'A veranda around an open courtyard, with a jaapi and a gamosa on the wall and a bamboo basket.',
         'hi': 'खुले आँगन के चारों ओर बरामदा, दीवार पर जापी और गामोसा, और एक बाँस की टोकरी।'},
        {'wall': '#e3d3b3', 'trim': '#5d4a30', 'floor': 'cement', 'light': 'warm'},
        [('jaapi', 'jaapi', 'house-wall-a', H),
         ('clock', 'clock-wall', 'house-wall-b'),
         ('frame-large', 'frame-wall-large', 'house-wall-c', img('pic-hills-mist', True)),
         ('mirror', 'wall-mirror', 'house-wall-d'),
         ('frame-small', 'frame-wall-small', 'house-wall-high', img('pic-paddy-fields')),
         ('bench', 'bench-veranda', 'veranda-bench'),
         ('xorai', 'xorai', 'bench-top-left', H),
         ('tumblers', 'steel-tumbler-set', 'bench-top-right'),
         ('side-table', 'side-table', 'veranda-right'),
         ('lantern', 'hurricane-lantern', 'veranda-right-top'),
         ('armchair', 'armchair-cane', 'veranda-seat-left'),
         ('stool', 'stool-low', 'veranda-seat-right'),
         ('mat', 'floor-mat-woven', 'veranda-mat'),
         ('hanging-plant-1', 'hanging-plant', 'veranda-hang-left'),
         ('hanging-plant-2', 'hanging-plant', 'veranda-hang-right'),
         ('clothesline', 'clothesline', 'clothesline'),
         ('flower-pots', 'flower-pots-row', 'pots-front'),
         ('big-plant', 'potted-plant-large', 'corner-front-right'),
         ('bicycle', 'bicycle', 'right-wall-floor', H),
         ('bucket', 'bucket-mug', 'tap-floor'),
         ('basket', 'bamboo-basket', 'left-wall-floor', H),
         ('gamosa', 'gamosa', 'right-wall-hang', H),
         ('umbrella', 'umbrella', 'left-wall-hang'),
         ('carrom', 'carrom-board', 'courtyard-centre')]),
]

for pack, envs in (('everyday-home', everyday), ('northeast-home', northeast)):
    path = os.path.join(ROOT, f'public/suite/packs/{pack}/environments.json')
    json.dump({'schema': 1, 'environments': envs}, open(path, 'w'), ensure_ascii=False, indent=1)
    print(path, [f"{e['id']}:{len(e['placements'])}" for e in envs])
