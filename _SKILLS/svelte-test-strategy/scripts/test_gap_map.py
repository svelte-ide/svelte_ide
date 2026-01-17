import json
import os
import sys
from pathlib import Path

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
root = root.resolve()


def list_files():
  for dirpath, dirnames, filenames in os.walk(root):
    dirnames[:] = [
      name for name in dirnames
      if name not in {'node_modules', '.git', 'dist', 'build', '.svelte-kit'}
    ]
    for filename in filenames:
      yield Path(dirpath) / filename


def is_test_file(path):
  name = path.name
  if '.test.' in name or '.spec.' in name:
    return True
  return '__tests__' in path.parts


def is_code_file(path):
  return path.suffix in {'.svelte', '.js', '.ts'} or path.name.endswith('.svelte.js')


def classify_path(path):
  parts = {part.lower() for part in path.parts}
  if 'routes' in parts:
    return 'routes'
  if 'components' in parts:
    return 'components'
  if 'stores' in parts:
    return 'stores'
  if 'core' in parts or 'services' in parts:
    return 'core'
  if 'utils' in parts or 'lib' in parts:
    return 'utilities'
  return 'other'


def collect_candidates():
  categories = {
    'components': [],
    'routes': [],
    'stores': [],
    'core': [],
    'utilities': [],
    'other': []
  }

  for path in list_files():
    if not path.is_file():
      continue
    if is_test_file(path):
      continue
    if not is_code_file(path):
      continue

    key = classify_path(path)
    categories[key].append(path)

  return categories


def compact(paths, limit=50):
  relative = [str(path.relative_to(root)) for path in paths]
  return {
    'count': len(relative),
    'sample': relative[:limit]
  }


categories = collect_candidates()

suggested = {
  'components': 'component tests with Svelte Testing Library',
  'routes': 'e2e or route integration tests with Playwright',
  'stores': 'unit tests with Vitest',
  'core': 'unit or integration tests with Vitest',
  'utilities': 'unit tests with Vitest',
  'other': 'review manually'
}

result = {
  'root': str(root),
  'categories': {key: compact(paths) for key, paths in categories.items()},
  'suggestedTests': suggested
}

print(json.dumps(result, indent=2))
