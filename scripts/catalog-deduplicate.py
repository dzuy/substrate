"""Compare raw-file and worksheet-content fingerprints before staging an incremental import."""
import collections
import hashlib
import json
import sys
from pathlib import Path


def content_hash(snapshot):
    # Preserve order, types, sheet names, and formulas; ignore only empty trailing cells/rows.
    sheets = []
    for sheet in snapshot["sheets"]:
        rows = []
        for row in sheet["rows"]:
            row = list(row)
            while row and row[-1] is None:
                row.pop()
            rows.append(row)
        while rows and not rows[-1]:
            rows.pop()
        sheets.append({"title": sheet["title"], "rows": rows})
    return hashlib.sha256(json.dumps(sheets, ensure_ascii=False, sort_keys=True).encode()).hexdigest()


if __name__ == "__main__":
    directory = Path(sys.argv[1])
    current = json.loads((directory / "snapshots.json").read_text())
    old = json.loads(Path(sys.argv[2]).read_text())
    live = json.loads((directory / "evidence-before.json").read_text())["rows"][0]["backup"]
    imported = {i["id"]: i for i in live["catalog_imports"]}
    for snapshot in old:
        record = imported.get("drive-" + snapshot["source"]["id"])
        if not record or record["sha256"] != snapshot["sha256"]:
            raise ValueError("Prior local snapshot does not match live import: " + snapshot["source"]["id"])
    old_hashes = collections.defaultdict(list)
    old_content = collections.defaultdict(list)
    for snapshot in old:
        old_hashes[snapshot["sha256"]].append(snapshot["source"]["id"])
        old_content[content_hash(snapshot)].append(snapshot["source"]["id"])
    raw_groups = collections.defaultdict(list)
    content_groups = collections.defaultdict(list)
    duplicate_old = []
    stage = []
    for snapshot in current:
        file_id = snapshot["source"]["id"]
        raw_groups[snapshot["sha256"]].append(file_id)
        digest = content_hash(snapshot)
        content_groups[digest].append(file_id)
        if snapshot["sha256"] in old_hashes:
            duplicate_old.append({"file_id": file_id, "matching_imported_ids": old_hashes[snapshot["sha256"]], "kind": "identical_bytes"})
        else:
            # Content-only duplicates are still staged so source rows retain provenance.
            stage.append(snapshot)
            if digest in old_content:
                duplicate_old.append({"file_id": file_id, "matching_imported_ids": old_content[digest], "kind": "identical_worksheet_values"})
    report = {
        "newFiles": len(current),
        "priorFiles": len(old),
        "uniqueNewByteHashes": len(raw_groups),
        "duplicateNewUploads": len(current) - len(raw_groups),
        "uniqueNewWorksheetContents": len(content_groups),
        "duplicatesOfImportedFiles": duplicate_old,
        "newDuplicateByteGroups": [ids for ids in raw_groups.values() if len(ids) > 1],
        "newDuplicateContentGroups": [ids for ids in content_groups.values() if len(ids) > 1],
        "filesToStage": len(stage),
    }
    (directory / "duplicate-report.json").write_text(json.dumps(report, indent=2) + "\n")
    (directory / "stage-snapshots.json").write_text(json.dumps(stage, ensure_ascii=False) + "\n")
    print(json.dumps({k: v for k, v in report.items() if not isinstance(v, list)}))
    print("Duplicates of imported files:", len(duplicate_old))
