#!/usr/bin/env python3
"""Generate the shipped library with the canonical sync script and report its
exact changed bytes for connector publication. Never commits or pushes."""
import argparse
import base64
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent


def blob_sha(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def build_report(baseline, library, before, after):
    files = []
    for path in sorted(after):
        data = after[path]
        if before.get(path) == data:
            continue
        files.append({"path": path, "bytes": len(data), "git_blob": blob_sha(data),
                      "sha256": hashlib.sha256(data).hexdigest(), "mode": "100644",
                      "content_base64": base64.b64encode(data).decode("ascii")})
    return {"version": 1, "repository": "Erasmus-CTM/pyodide-interaktiv",
            "baseline": baseline, "library": library, "files": files,
            "delete_paths": sorted(set(before) - set(after))}


def emit(report):
    manifest = {key: value for key, value in report.items() if key != "files"}
    manifest["files"] = [{key: value for key, value in file.items() if key != "content_base64"}
                         | {"parts": (len(file["content_base64"]) + 2999) // 3000}
                         for file in report["files"]]
    encoded = json.dumps(manifest, ensure_ascii=True, separators=(",", ":"))
    print("CTM_GENERATED_MANIFEST " + encoded, flush=True)
    chunks = 0
    for file in report["files"]:
        value = file["content_base64"]
        for index, start in enumerate(range(0, len(value), 3000)):
            print("CTM_GENERATED_CHUNK " + json.dumps({
                "path": file["path"], "part": index, "data": value[start:start + 3000]
            }, separators=(",", ":")), flush=True)
            chunks += 1
    print("CTM_GENERATED_COMPLETE " + json.dumps({
        "files": len(report["files"]), "chunks": chunks,
        "manifest_sha256": hashlib.sha256(encoded.encode()).hexdigest()
    }, separators=(",", ":")), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()
    spec = importlib.util.spec_from_file_location("sync_ctm_libs", ROOT / "scripts/sync-ctm-libs.py")
    sync = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(sync)
    targets = [target for _, target in sync.COPIES] + [".github/ctm-libs-source.json"]
    baseline = subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", "HEAD"], text=True).strip()
    library = subprocess.check_output(["git", "-C", str(args.source), "rev-parse", "HEAD"], text=True).strip()
    before = {}
    names = subprocess.check_output(["git", "-C", str(ROOT), "ls-files", "-z", "--", *targets]).decode().split("\0")
    for name in filter(None, names):
        before[name] = subprocess.check_output(["git", "-C", str(ROOT), "show", "HEAD:" + name])
    subprocess.run([sys.executable, str(ROOT / "scripts/sync-ctm-libs.py"), str(args.source)], check=True)
    subprocess.run([sys.executable, str(ROOT / "scripts/sync-ctm-libs.py"), str(args.source), "--check"], check=True)
    after = {}
    for _, target in sync.COPIES:
        for relative, data in sync.present(ROOT / target).items():
            path = str(Path(target) / relative).replace("\\", "/") if relative else target
            after[path] = data
    after[".github/ctm-libs-source.json"] = sync.RECORD.read_bytes()
    report = build_report(baseline, library, before, after)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=True, indent=2) + "\n")
    emit(report)


if __name__ == "__main__":
    main()
