---
name: svelte-test-strategy
description: Analyze Svelte and SvelteKit codebases to produce clean automated testing strategies and plans. Use when asked to review test coverage, propose a testing plan, or design test skeletons for Svelte projects.
---

# Workflow

1) Identify project type and existing tooling
- Run `scripts/scan_repo.py` to detect frameworks and test tools.
- Review `package.json` scripts and test configs.
- Use `rg` to locate existing tests and critical flows.

2) Map code to test types
- Run `scripts/test_gap_map.py` to classify modules.
- Load `references/testing-heuristics.md` for decision rules.
- Keep tool choices aligned with the repo unless asked to change.

3) Produce a minimal, risk-driven plan
- Prioritize core flows and failure-prone integrations.
- Keep plan small: unit for pure logic, integration for IO, e2e for user-critical flows.
- Note missing seams or refactors that would improve testability.

4) Generate test skeletons only when explicitly asked
- If asked, keep skeletons minimal and aligned with detected tooling.
- Do not add new frameworks unless requested.

# Resources

- `references/testing-heuristics.md`
- `references/framework-mapping.md`
- `scripts/scan_repo.py`
- `scripts/test_gap_map.py`
