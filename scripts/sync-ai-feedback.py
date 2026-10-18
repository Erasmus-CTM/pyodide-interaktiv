#!/usr/bin/env python3
"""Ship a copy of ai-feedback with pyodide-interaktiv, so that the usual
`quarto add Erasmus-CTM/pyodide-interaktiv` also installs it and projects made
before the shared ai-feedback keep building with feedback.

  python scripts/sync-ai-feedback.py SOURCE            # copy SOURCE/_extensions/ai-feedback, record its commit
  python scripts/sync-ai-feedback.py SOURCE --check    # fail if the copy differs from SOURCE

SOURCE is a checkout of Erasmus-CTM/ai-feedback at the commit to ship
(CI checks out the commit recorded in .github/ai-feedback-source.json).
Temporary: to be revisited with the pyodide-interaktiv maintainers.
"""
import argparse, filecmp, json, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TARGET = ROOT / '_extensions' / 'ai-feedback'
RECORD = ROOT / '.github' / 'ai-feedback-source.json'


def differences(left, right):
    comparison = filecmp.dircmp(left, right)
    found = [f'{p}' for p in comparison.left_only + comparison.right_only + comparison.diff_files + comparison.funny_files]
    for name in comparison.common_dirs:
        found += [f'{name}/{p}' for p in differences(Path(left) / name, Path(right) / name)]
    return found


parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path)
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
extension = args.source / '_extensions' / 'ai-feedback'
if not (extension / '_extension.yml').is_file():
    sys.exit(f'{args.source} is not an ai-feedback checkout')
if args.check:
    changed = differences(extension, TARGET) if TARGET.is_dir() else ['(missing)']
    if changed:
        sys.exit('The shipped _extensions/ai-feedback differs from ' + str(args.source) + ': ' + ', '.join(changed)
                 + '\nRun: python scripts/sync-ai-feedback.py <ai-feedback checkout>')
    print('Shipped ai-feedback matches', args.source)
else:
    commit = subprocess.check_output(['git', '-C', str(args.source), 'rev-parse', 'HEAD'], text=True).strip()
    if TARGET.exists():
        shutil.rmtree(TARGET)
    shutil.copytree(extension, TARGET)
    RECORD.write_text(json.dumps({'repository': 'Erasmus-CTM/ai-feedback', 'commit': commit}, indent=2) + '\n')
    print('Shipped ai-feedback', commit)
