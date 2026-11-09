"""
Builds the global screening grid (public/data/earth-grid.bin + .json) used by the Global search.

  pip install kgcpy geonamescache scipy numpy pillow
  python3 scripts/build-earth-grid.py

Every land cell (0.5 degrees, about 55 km) gets:
  - Koppen-Geiger climate class, 1986-2010 at 100 arc-seconds (Rubel et al.), majority per cell (kgcpy)
  - distance to the nearest town of 1,000+ people (GeoNames cities1000, via geonamescache)
  - impact structure in or near the cell (Earth Impact Database list in src/data/impacts.ts)
  - Holocene volcano proximity, weighted toward basaltic types (Smithsonian GVP list, plotly/datasets copy)
  - salt flats and glaciers (Natural Earth 10m playas and glaciated areas)
  - Natural Earth region name (deserts, plateaus, ranges...) and country (Natural Earth 50m countries)
The app turns these into analog factors in src/lib/earthGrid.ts, where the mapping is documented.
"""
import io, json, math, re, sys, time, urllib.request, zipfile, importlib.resources as ir
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'data'
RES = 0.5
W, H = int(360 / RES), int(180 / RES)
NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
Image.MAX_IMAGE_PIXELS = None

def fetch(url):
    with urllib.request.urlopen(url, timeout=120) as r:
        return r.read()

def unit(lat, lon):
    la, lo = np.radians(lat), np.radians(lon)
    return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], axis=-1)

def chord_to_km(c):
    return 2 * 6371.0 * np.arcsin(np.clip(c / 2, 0, 1))

t0 = time.time()
# ---------- 1. Koppen-Geiger classes ----------
import kgcpy  # noqa: F401  (only for its data files)
png = ir.files('kgcpy').joinpath('kmz_int_reshape.png').read_bytes()
kg = np.array(Image.open(io.BytesIO(png)))           # 6480 x 12960, 1..31 classes, 32 = ocean
codes = ['', 'Af', 'Am', 'As', 'Aw', 'BSh', 'BSk', 'BWh', 'BWk', 'Cfa', 'Cfb', 'Cfc', 'Csa', 'Csb', 'Csc', 'Cwa', 'Cwb', 'Cwc',
         'Dfa', 'Dfb', 'Dfc', 'Dfd', 'Dsa', 'Dsb', 'Dsc', 'Dsd', 'Dwa', 'Dwb', 'Dwc', 'Dwd', 'EF', 'ET']
B = kg.shape[1] // W                                 # 18 pixels per cell side
blocks = kg.reshape(H, B, W, B)
counts = np.stack([(blocks == c).sum(axis=(1, 3)) for c in range(1, 32)], axis=-1)   # H x W x 31
landpx = counts.sum(axis=-1)
land = landpx >= 0.25 * B * B
klass = np.where(land, counts.argmax(axis=-1) + 1, 0).astype(np.uint8)
print(f'climate: {land.sum()} land cells ({time.time()-t0:.1f}s)')

lat_c = 90 - (np.arange(H) + 0.5) * RES
lon_c = -180 + (np.arange(W) + 0.5) * RES
LAT, LON = np.meshgrid(lat_c, lon_c, indexing='ij')
cells = np.argwhere(land)
cl_lat, cl_lon = LAT[land], LON[land]
cu = unit(cl_lat, cl_lon)

# ---------- 2. nearest town of 1,000+ people ----------
import geonamescache  # noqa: F401
cities = json.loads(ir.files('geonamescache').joinpath('data/cities1000.json').read_bytes())
cl = [c for c in cities.values() if (c.get('population') or 0) >= 1000]
tlat = np.array([c['latitude'] for c in cl], float); tlon = np.array([c['longitude'] for c in cl], float)
tree = cKDTree(unit(tlat, tlon))
d, idx = tree.query(cu)
town_km = chord_to_km(d)
print(f'towns: {len(cl)} places with 1,000+ people, median distance {np.median(town_km):.0f} km')

# ---------- 3. impact structures (same list as the app) ----------
rows = re.findall(r"\['([^']*(?:\\'[^']*)*)', '([^']*)', (-?[\d.]+), (-?[\d.]+), ([\d.]+), ([\d.]+)\]", (ROOT / 'src/data/impacts.ts').read_text())
if not rows: rows = re.findall(r'\["([^"]*)", \'([^\']*)\', (-?[\d.]+), (-?[\d.]+), ([\d.]+), ([\d.]+)\]', (ROOT / 'src/data/impacts.ts').read_text())
imp = [(float(a), float(b), float(c), float(e)) for _, _, a, b, c, e in rows]
imp += [(float(a), float(b), float(c), float(e)) for _, _, a, b, c, e in re.findall(r'\["([^"]*)", \'([^\']*)\', (-?[\d.]+), (-?[\d.]+), ([\d.]+), ([\d.]+)\]', (ROOT / 'src/data/impacts.ts').read_text())]
imp = list(dict.fromkeys(imp))
pres = lambda ma: 1 if ma < 1 else 0.85 if ma < 60 else 0.6 if ma < 500 else 0.4
crater = np.zeros(len(cells))
half = 0.5 * RES * 111.32 * 1.15                      # about half a cell (km), so a structure inside the cell counts
for la, lo, km, ma in imp:
    dk = chord_to_km(np.linalg.norm(cu - unit(np.array([la]), np.array([lo]))[0], axis=1))
    r = np.maximum(0, dk - half) / max(0.05, km / 2)
    near = np.where(r <= 1, 1.0, np.where(r < 3, 1 - (r - 1) / 2, 0))
    crater = np.maximum(crater, near * pres(ma))
print(f'craters: {len(imp)} structures, {int((crater > 0.5).sum())} cells with one')

# ---------- 4. Holocene volcanoes ----------
vcsv = fetch('https://raw.githubusercontent.com/plotly/datasets/master/volcano_db.csv').decode('latin-1')
import csv
vr = list(csv.DictReader(io.StringIO(vcsv)))
keys = vr[0].keys()
kl = next(k for k in keys if 'lat' in k.lower()); ko = next(k for k in keys if 'lon' in k.lower()); kt = next(k for k in keys if k.lower().strip() == 'type')
def vweight(t):
    t = (t or '').lower()
    if 'submarine' in t or 'subglacial' in t: return 0
    if any(s in t for s in ('shield', 'field', 'cinder', 'fissure', 'scoria', 'maar', 'lava cone', 'pyroclastic cone', 'tuff cone')): return 1.0
    return 0.6
V = [(float(r[kl]), float(r[ko]), vweight(r[kt])) for r in vr if r[kl] and r[ko]]
V = [v for v in V if v[2] > 0]
vt = cKDTree(unit(np.array([v[0] for v in V]), np.array([v[1] for v in V])))
vw = np.array([v[2] for v in V])
volc = np.zeros(len(cells))
for k, (dd, ii) in enumerate(zip(*vt.query(cu, k=4))):
    km = chord_to_km(dd)
    prox = np.clip(1 - (km - 30) / 70, 0, 1)          # 30 km or less = 1, 100 km = 0
    volc[k] = float(np.max(prox * vw[ii]))
print(f'volcanoes: {len(V)} subaerial, {int((volc > 0.5).sum())} cells near one; types from column "{kt}"')

# ---------- 5. Natural Earth polygons: salt flats, glaciers, regions, countries ----------
SS = 4
def raster(features, value_of, order=None):
    img = Image.new('I', (W * SS, H * SS), 0)
    dr = ImageDraw.Draw(img)
    feats = list(features)
    if order: feats.sort(key=order)
    for f in feats:
        v = value_of(f)
        if not v: continue
        g = f['geometry']
        polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']] if g['type'] == 'Polygon' else []
        for poly in polys:
            ring = poly[0]
            pts = [((x + 180) / RES * SS, (90 - y) / RES * SS) for x, y in ring]
            if len(pts) >= 3: dr.polygon(pts, fill=int(v))
    a = np.array(img, dtype=np.int64).reshape(H, SS, W, SS)
    return a

def area(f):
    g = f['geometry']; polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    s = 0
    for p in polys:
        r = p[0]
        s += abs(sum(r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1] for i in range(len(r) - 1))) / 2
    return s

playas = json.loads(fetch(NE + 'ne_10m_playas.geojson'))['features']
pl = raster(playas, lambda f: 1).max(axis=(1, 3)) > 0
near_pl = np.zeros_like(pl)
for dy in (-1, 0, 1):
    for dx in (-1, 0, 1):
        near_pl |= np.roll(np.roll(pl, dy, 0), dx, 1)
glac = json.loads(fetch(NE + 'ne_10m_glaciated_areas.geojson'))['features']
gl = raster(glac, lambda f: 1).mean(axis=(1, 3)) >= 0.25
print(f'salt flats: {int(pl.sum())} cells; glaciers: {int(gl.sum())} cells')

regs = json.loads(fetch(NE + 'ne_10m_geography_regions_polys.geojson'))['features']
regs = [f for f in regs if (f['properties'].get('FEATURECLA') or f['properties'].get('featurecla') or '') not in ('Continent', 'Geoarea') and f['properties'].get('NAME')]
reg_names = [['', '']] + [[f['properties']['NAME'].title() if f['properties']['NAME'].isupper() else f['properties']['NAME'],
                           (f['properties'].get('FEATURECLA') or '').replace('Range/mtn', 'Mountains')] for f in regs]
for i, f in enumerate(regs): f['_i'] = i + 1
rg = raster(regs, lambda f: f['_i'], order=lambda f: -area(f))
# majority non-zero region per cell
rgf = rg.transpose(0, 2, 1, 3).reshape(H, W, SS * SS)
region = np.zeros((H, W), np.int64)
nz = rgf > 0
for y, x in np.argwhere(nz.any(axis=-1)):
    v = rgf[y, x][rgf[y, x] > 0]
    region[y, x] = np.bincount(v).argmax()

ctry = json.loads(fetch(NE + 'ne_50m_admin_0_countries.geojson'))['features']
cnames = [''] + [f['properties'].get('NAME') or f['properties'].get('ADMIN') for f in ctry]
for i, f in enumerate(ctry): f['_i'] = i + 1
cr = raster(ctry, lambda f: f['_i'], order=lambda f: -area(f)).transpose(0, 2, 1, 3).reshape(H, W, SS * SS)
country = np.zeros((H, W), np.int64)
for y, x in cells:
    v = cr[y, x][cr[y, x] > 0]
    if v.size: country[y, x] = np.bincount(v).argmax()
# coastal cells with no polygon hit: borrow the nearest country cell
has = country[land] > 0
ct = cKDTree(cu[has]); _, ni = ct.query(cu[~has])
cc = country[land]; cc[~has] = cc[has][ni]; country[land] = cc
print(f'regions: {len(regs)} named; countries: {len(ctry)} ({time.time()-t0:.1f}s)')

# ---------- 6. write ----------
bitmap = np.packbits(land.reshape(-1).astype(np.uint8))
flags = (pl[land].astype(np.uint8) << 5) | (near_pl[land].astype(np.uint8) << 6) | (gl[land].astype(np.uint8) << 7)
rec = np.zeros((len(cells), 6), np.uint8)
rec[:, 0] = klass[land] | flags
rec[:, 1] = np.clip(np.round(town_km / 2), 0, 255)
rec[:, 2] = (np.round(crater * 15).astype(np.uint8) << 4) | np.round(volc * 15).astype(np.uint8)
rec[:, 3] = country[land].astype(np.uint8)
rec[:, 4] = (region[land] & 255).astype(np.uint8)
rec[:, 5] = (region[land] >> 8).astype(np.uint8)
assert len(cnames) < 256
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'earth-grid.bin').write_bytes(bitmap.tobytes() + rec.tobytes())
meta = {
    'version': 1, 'res': RES, 'w': W, 'h': H, 'land': int(len(cells)), 'record': 6, 'built': time.strftime('%Y-%m-%d'),
    'layout': 'land bitmap (w*h bits, row-major from 90N, 180W), then 6 bytes per land cell in raster order: '
              'climate class | salt flat<<5 | salt flat nearby<<6 | glacier<<7, town km/2, crater*15<<4 | volcano*15, country, region (2 bytes, little-endian)',
    'climates': codes, 'countries': cnames, 'regions': reg_names,
}
(OUT / 'earth-grid.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')))
print(f'wrote {len(cells)} land cells: bin {(OUT / "earth-grid.bin").stat().st_size/1024:.0f} KB, json {(OUT / "earth-grid.json").stat().st_size/1024:.0f} KB ({time.time()-t0:.1f}s)')

# ---------- sanity checks ----------
def at(la, lo):
    y, x = int((90 - la) / RES), int((lo + 180) / RES)
    if not land[y, x]: return 'ocean'
    k = np.flatnonzero((cells[:, 0] == y) & (cells[:, 1] == x))[0]
    return f"{codes[klass[y, x]]} town {town_km[k]:.0f} km crater {crater[k]:.2f} volc {volc[k]:.2f} playa {int(pl[y, x])} glacier {int(gl[y, x])} region '{reg_names[region[y, x]][0]}' country '{cnames[country[y, x]]}'"
for n, la, lo in [('Kuala Lumpur', 3.14, 101.69), ('Atacama Yungay', -24.08, -70.17), ('Dry Valleys', -77.5, 161.5), ('Svalbard Bockfjord', 79.43, 13.3),
                  ('Sahara', 23.0, 10.0), ('Tso Kar', 33.31, 78.0), ('Meteor Crater', 35.03, -111.02), ('Kamestastin', 55.88, -63.3),
                  ('Harrat Khaybar', 25.0, 39.9), ('Salar de Uyuni', -20.13, -67.49), ('Haughton', 75.38, -89.68), ('Antarctic plateau', -80, 60)]:
    print(f'  {n}: {at(la, lo)}')
