# Svelte Testing Stack Mapping

## Svelte (Vite)
- Unit and integration: Vitest
- Component tests: @testing-library/svelte
- E2E: Playwright

## SvelteKit
- Unit and integration: Vitest
- Route and workflow E2E: Playwright

## General guidance
- Prefer existing tools already present in the repo.
- If no tools exist, suggest Vitest + Playwright as defaults for Svelte projects.
