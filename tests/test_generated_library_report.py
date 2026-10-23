import base64
import contextlib
import hashlib
import importlib.util
import io
import json
import tempfile
from unittest.mock import patch
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("report", Path(__file__).resolve().parents[1] / "scripts/report-shipped-ctm-libs.py")
report = importlib.util.module_from_spec(spec)
spec.loader.exec_module(report)


class GeneratedReportTests(unittest.TestCase):
    def test_exact_changed_bytes_and_deletions(self):
        before = {"same": b"same", "removed": b"old", "changed": b"before"}
        after = {"same": b"same", "changed": "Nynorsk æøå".encode(), "binary": b"\x00\xff"}
        result = report.build_report("a" * 40, "b" * 40, before, after)
        self.assertEqual(result["delete_paths"], ["removed"])
        self.assertEqual([file["path"] for file in result["files"]], ["binary", "changed"])
        for file in result["files"]:
            data = base64.b64decode(file["content_base64"], validate=True)
            self.assertEqual(data, after[file["path"]])
            self.assertEqual(file["bytes"], len(data))
            self.assertEqual(file["sha256"], hashlib.sha256(data).hexdigest())
            self.assertEqual(file["git_blob"], report.blob_sha(data))

    def test_canonical_sync_records_lf_bytes_on_every_platform(self):
        # Exercise the actual writer with binary/text copies, without depending
        # on a platform's default newline translation or external repository.
        spec = importlib.util.spec_from_file_location("sync", Path(__file__).resolve().parents[1] / "scripts/sync-ctm-libs.py")
        sync = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(sync)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source, target = root / "source", root / "target"
            (source / "_extensions/ctm-libs/lua").mkdir(parents=True)
            (source / "_extensions/ctm-libs/lua/ctm.lua").write_bytes(b"-- fixture")
            (source / "templates/ai-feedback").mkdir(parents=True)
            (target / ".github").mkdir(parents=True)
            record = target / ".github/ctm-libs-source.json"
            files = {
                "_extensions/ctm-libs": {"lua/ctm.lua": b"-- fixture"},
                "templates/ai-feedback": {"forward.lua": b"-- forward"},
                "bootstrap/ctm-bootstrap.lua": {"": b"-- bootstrap"},
            }
            with patch.object(sync, "ROOT", target), patch.object(sync, "RECORD", record), \
                    patch.object(sync, "tracked", side_effect=lambda _, path: files[path]), \
                    patch.object(sync.subprocess, "check_output", return_value="a" * 40), \
                    patch("sys.argv", ["sync-ctm-libs.py", str(source)]), contextlib.redirect_stdout(io.StringIO()):
                sync.main()
            data = record.read_bytes()
            self.assertNotIn(b"\r", data)
            self.assertEqual(data.count(b"\n"), 4)
            self.assertEqual(json.loads(data)["commit"], "a" * 40)
            self.assertEqual((target / "_extensions/ctm-libs/lua/ctm.lua").read_bytes(), b"-- fixture")

    def test_bounded_chunks_reconstruct_and_have_complete_manifest(self):
        result = report.build_report("a" * 40, "b" * 40, {}, {"large": b"x" * 10001, "empty": b""})
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            report.emit(result)
        lines = output.getvalue().splitlines()
        raw_manifest = lines[0].split(" ", 1)[1]
        manifest = json.loads(raw_manifest)
        complete = json.loads(lines[-1].split(" ", 1)[1])
        self.assertEqual(complete["manifest_sha256"], hashlib.sha256(raw_manifest.encode()).hexdigest())
        chunks = [json.loads(line.split(" ", 1)[1]) for line in lines[1:-1]]
        self.assertEqual(complete["chunks"], len(chunks))
        for file in manifest["files"]:
            pieces = [item for item in chunks if item["path"] == file["path"]]
            self.assertEqual([item["part"] for item in pieces], list(range(file["parts"])))
            self.assertTrue(all(len(item["data"]) <= 3000 for item in pieces))
            data = base64.b64decode("".join(item["data"] for item in pieces), validate=True)
            self.assertEqual(hashlib.sha256(data).hexdigest(), file["sha256"])
        self.assertEqual(report.blob_sha(b""), "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391")


if __name__ == "__main__":
    unittest.main()
