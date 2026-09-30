"""Preserve all original worksheet cells and map Drive exports to file provenance."""
import collections
import datetime
import hashlib
import io
import json
import re
import sys
import zipfile
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
def label(value):
    value = re.sub(r'\.xlsx$', '', value, flags=re.I)
    return re.sub(r'(\(\d+\))+$', '', value).lower()

def capture(archive):
    manifest = json.loads((ROOT / 'data/catalog/brand-files-manifest.json').read_text())
    remaining = list(manifest['files'])
    destination = ROOT / 'data/catalog/brand-workbooks'
    destination.mkdir(exist_ok=True)
    snapshots = []
    with zipfile.ZipFile(archive) as bundle:
        for entry in bundle.infolist():
            if not entry.filename.endswith('.xlsx'):
                continue
            body = bundle.read(entry)
            candidates = [f for f in remaining if label(f['title']) == label(Path(entry.filename).name) and int(f['size']) == len(body)]
            if not candidates:
                raise ValueError('Unmapped archive entry: ' + entry.filename)
            # Identical-named copies of the same size are attached in creation order.
            # Readable exports remain available for independent content comparison.
            source = sorted(candidates, key=lambda f: f['created_time'])[0]
            remaining.remove(source)
            (destination / (source['id'] + '.xlsx')).write_bytes(body)
            workbook = openpyxl.load_workbook(io.BytesIO(body), data_only=False)
            sheets = []
            for sheet in workbook:
                rows = [[v.isoformat() if isinstance(v, (datetime.date, datetime.datetime)) else v for v in row] for row in sheet.iter_rows(values_only=True)]
                sheets.append({'title': sheet.title, 'rows': rows})
            snapshots.append({'source': source, 'sha256': hashlib.sha256(body).hexdigest(), 'sheets': sheets})
    if remaining:
        raise ValueError('Archive omitted ' + str(len(remaining)) + ' files')
    (ROOT / 'data/catalog/brand-workbook-snapshots.json').write_text(json.dumps(snapshots, ensure_ascii=False, indent=2) + '\n')
    headers = collections.Counter()
    for snapshot in snapshots:
        for sheet in snapshot['sheets']:
            for row in sheet['rows']:
                if any(re.fullmatch(r'Product(?: Name| name)?', str(v or '')) for v in row):
                    headers[tuple(str(v or '') for v in row)] += 1
    print(json.dumps({'files':len(snapshots), 'uniqueBytes':len({s['sha256'] for s in snapshots}), 'headers':[{'count':n,'columns':list(h)} for h,n in headers.items()]}, indent=2))

if __name__ == '__main__':
    capture(sys.argv[1])
