# Testing Heuristics

## Decision rules
- Use unit tests for pure functions, stores, and deterministic logic.
- Use integration tests for code that touches IO, browser APIs, or external services.
- Use component tests for UI behavior and rendering logic.
- Use e2e tests for critical user flows that cross modules.

## Risk signals
- Authentication, persistence, and data sync paths.
- Complex UI state or multi-step workflows.
- Areas with frequent change or regressions.
- Third-party integrations or API boundaries.

## Planning output
- List the smallest set of tests that cover high-risk paths.
- Prefer few high-value tests over broad low-value coverage.
- Call out seams or abstractions needed to test cleanly.
