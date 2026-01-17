import json
import os
import sys
from pathlib import Path

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()
root = root.resolve()

package_path = root / 'package.json'
package_data = {}
if package_path.exists():
  package_data = json.loads(package_path.read_text(encoding='utf-8'))

dependencies = package_data.get('dependencies', {}) if isinstance(package_data, dict) else {}
dev_dependencies = package_data.get('devDependencies', {}) if isinstance(package_data, dict) else {}
scripts = package_data.get('scripts', {}) if isinstance(package_data, dict) else {}


def pick_version(name):
  return dependencies.get(name) or dev_dependencies.get(name)


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


def is_svelte_file(path):
  return path.suffix == '.svelte'


def collect_files():
  svelte_files = []
  test_files = []
  for path in list_files():
    if is_svelte_file(path):
      svelte_files.append(path)
    if is_test_file(path):
      test_files.append(path)
  return svelte_files, test_files


svelte_files, test_files = collect_files()

config_candidates = [
  'svelte.config.js',
  'vite.config.js',
  'vite.config.ts',
  'vitest.config.js',
  'vitest.config.ts',
  'playwright.config.js',
  'playwright.config.ts',
  'jest.config.js',
  'jest.config.ts',
  'cypress.config.js',
  'cypress.config.ts'
]
config_files = [name for name in config_candidates if (root / name).exists()]

known_packages = [
  'svelte',
  '@sveltejs/kit',
  'vite',
  'vitest',
  'jest',
  '@playwright/test',
  'playwright',
  'cypress',
  '@testing-library/svelte'
]


detected = {name: pick_version(name) for name in known_packages if pick_version(name)}


def compact_paths(paths, limit=50):
  relative = [str(path.relative_to(root)) for path in paths]
  return {
    'count': len(relative),
    'sample': relative[:limit]
  }


result = {
  'root': str(root),
  'packageJson': {
    'path': str(package_path) if package_path.exists() else None,
    'scripts': {name: script for name, script in scripts.items() if isinstance(script, str)}
  },
  'detected': detected,
  'configs': config_files,
  'directories': {
    'src': (root / 'src').exists(),
    'routes': (root / 'src' / 'routes').exists(),
    'lib': (root / 'src' / 'lib').exists(),
    'components': (root / 'src' / 'components').exists(),
    'stores': (root / 'src' / 'stores').exists()
  },
  'files': {
    'svelte': compact_paths(svelte_files),
    'tests': compact_paths(test_files)
  }
}

print(json.dumps(result, indent=2))
