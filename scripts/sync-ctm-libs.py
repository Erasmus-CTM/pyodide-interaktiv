#!/usr/bin/env python3
"""Ship a generated copy of ctm-libs with pyodide-interaktiv (decision 5 of
the CTM consolidation: `quarto add Erasmus-CTM/pyodide-interaktiv` stays the
whole install without the CTM Assessment package).

  python scripts/sync-ctm-libs.py SOURCE            # write the copy, record SOURCE's commit
  python scripts/sync-ctm-libs.py SOURCE --check    # fail if the copy differs from SOURCE

SOURCE is a git checkout of Erasmus-CTM/ctm-libs (CI checks out the commit
recorded in .github/ctm-libs-source.json). From its tracked files:
  _extensions/ctm-libs/            -> _extensions/ctm-libs/              (the library)
  templates/ai-feedback/           -> _extensions/ai-feedback/           (the forwarder that
                                      replaces 1.8 projects' ai-feedback 0.8.1 folder)
  bootstrap/ctm-bootstrap.lua      -> _extensions/pyodide-interaktiv/ctm-bootstrap.lua
These are the only ctm-libs files in this repository; never edit them by hand.
The recorded commit is the ctm-libs commit the CTM Assessment package pins
(E13); a lag between pull requests is allowed.
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RECORD = ROOT / '.github' / 'ctm-libs-source.json'
# (path in ctm-libs, path here); a folder copies every tracked file below it.
COPIES = [('_extensions/ctm-libs', '_extensions/ctm-libs'),
          ('templates/ai-feedback', '_extensions/ai-feedback'),
          ('bootstrap/ctm-bootstrap.lua', '_extensions/pyodide-interaktiv/ctm-bootstrap.lua')]


def tracked(source, path):
    """{relative path: bytes} of the files git tracks under `path` in SOURCE."""
    names = subprocess.check_output(['git', '-C', str(source), 'ls-files', '-z', '--', path], text=True).split('\0')
    files = {}
    for name in filter(None, names):
        relative = Path(name).relative_to(path).as_posix() if name != path else ''
        files[relative] = (source / name).read_bytes()
    return files


def present(target):
    if target.is_file():
        return {'': target.read_bytes()}
    if not target.is_dir():
        return {}
    return {p.relative_to(target).as_posix(): p.read_bytes() for p in sorted(target.rglob('*')) if p.is_file()}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('source', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    source = args.source.resolve()
    if not (source / '_extensions' / 'ctm-libs' / 'lua' / 'ctm.lua').is_file() or not (source / 'templates' / 'ai-feedback').is_dir():
        sys.exit(f'{args.source} is not a ctm-libs checkout with templates/ai-feedback (consolidation step 3 or later)')
    commit = subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip()
    if args.check:
        recorded = json.loads(RECORD.read_text())
        problems = []
        if recorded.get('commit') != commit:
            problems.append(f'.github/ctm-libs-source.json records {recorded.get("commit")}, the checkout is {commit}')
        for origin, here in COPIES:
            want, have = tracked(source, origin), present(ROOT / here)
            for name in sorted(set(want) | set(have)):
                if want.get(name) != have.get(name):
                    state = 'missing' if name not in have else 'extra' if name not in want else 'differs'
                    problems.append(f'{here}/{name} {state}'.replace('/ ', ' '))
        if problems:
            sys.exit('The shipped ctm-libs differs from ' + str(args.source) + ':\n  ' + '\n  '.join(problems)
                     + '\nRun: python scripts/sync-ctm-libs.py <ctm-libs checkout at the recorded commit>')
        print('The shipped ctm-libs matches ctm-libs', commit)
        return
    for origin, here in COPIES:
        target = ROOT / here
        files = tracked(source, origin)
        if not files:
            sys.exit(f'{origin} has no tracked files in {args.source}')
        if target.is_dir():
            shutil.rmtree(target)
        for name, data in files.items():
            path = target / name if name else target
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    RECORD.write_text(json.dumps({'repository': 'Erasmus-CTM/ctm-libs', 'commit': commit}, indent=2) + '\n')
    print('Shipped ctm-libs', commit)


if __name__ == '__main__':
    main()
