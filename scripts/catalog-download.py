"""Materialize authenticated Drive download references without logging signed URLs."""
import concurrent.futures
import json
import sys
import time
import urllib.request
import zipfile
from pathlib import Path


def download(entry, destination):
    target = destination / (entry["id"] + ".xlsx")
    expected = int(entry["size"])
    if target.exists() and target.stat().st_size == expected and zipfile.is_zipfile(target):
        return entry["id"]
    for attempt in range(3):
        try:
            with urllib.request.urlopen(entry["url"], timeout=60) as response:
                body = response.read()
            if len(body) != expected:
                raise ValueError("File size differs from Drive metadata")
            temporary = target.with_suffix(".partial")
            temporary.write_bytes(body)
            if not zipfile.is_zipfile(temporary):
                raise ValueError("Downloaded file is not an Excel archive")
            temporary.replace(target)
            return entry["id"]
        except Exception:
            if attempt == 2:
                raise RuntimeError("Download failed for " + entry["id"]) from None
            time.sleep(attempt + 1)


if __name__ == "__main__":
    references = json.loads(Path(sys.argv[1]).read_text())
    destination = Path(sys.argv[2])
    destination.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(download, entry, destination) for entry in references]
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            future.result()
            if index % 50 == 0 or index == len(futures):
                print(f"Downloaded {index}/{len(futures)}", flush=True)
