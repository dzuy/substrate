"""Capture original workbooks, preserving source metadata and all worksheet values."""
import collections
import datetime
import hashlib
import json
import sys
from pathlib import Path

import openpyxl


def capture(directory):
    directory = Path(directory)
    manifest = json.loads((directory / "manifest.json").read_text())
    snapshots = []
    headers = collections.Counter()
    for source in manifest["files"]:
        path = directory / "workbooks" / (source["id"] + ".xlsx")
        body = path.read_bytes()
        if len(body) != int(source["size"]):
            raise ValueError("Size mismatch: " + source["id"])
        workbook = openpyxl.load_workbook(path, data_only=False)
        sheets = []
        for sheet in workbook:
            rows = [
                [v.isoformat() if isinstance(v, (datetime.date, datetime.datetime)) else v for v in row]
                for row in sheet.iter_rows(values_only=True)
            ]
            sheets.append({"title": sheet.title, "rows": rows})
            for row in rows:
                if any(str(v or "").lower() in ("product", "product name", "product_name") for v in row):
                    headers[tuple(str(v or "") for v in row)] += 1
        snapshots.append({
            "source": source,
            "sha256": hashlib.sha256(body).hexdigest(),
            "sheets": sheets,
        })
    (directory / "snapshots.json").write_text(json.dumps(snapshots, ensure_ascii=False, indent=2) + "\n")
    report = {
        "files": len(snapshots),
        "uniqueBytes": len({s["sha256"] for s in snapshots}),
        "headers": [{"count": count, "columns": list(header)} for header, count in headers.most_common()],
    }
    (directory / "capture-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "headers"}))


if __name__ == "__main__":
    capture(sys.argv[1])
