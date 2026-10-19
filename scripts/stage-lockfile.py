#!/usr/bin/env python3
"""裁剪发布锁文件的 workspace importers，版本、integrity 与 snapshots 均保持原样。"""
from pathlib import Path
import re
import sys

source = Path(sys.argv[1]).read_text()
start = source.index('importers:\n')
end = source.index('\npackages:\n', start)
blocks = re.split(r'(?=^  [^ \n][^\n]*:.*$)', source[start + len('importers:\n'):end], flags=re.M)
allowed = {'.:', 'apps/api:', 'packages/contracts:', 'packages/database:'}
kept = ''.join(block for block in blocks if not block.strip() or block.splitlines()[0].split(':', 1)[0].strip() + ':' in allowed)
assert all(f'  {key}\n' in kept for key in allowed)
Path(sys.argv[2]).write_text(source[:start] + 'importers:\n' + kept + source[end:])
