# Theme Service Review

## Current Implementation

**File:** `svelte-ide/core/themeService.svelte.js`

### Architecture

```
themeService (singleton)
├── State: mode ($state), customTheme ($state)
├── Derived: currentTheme ($derived from mode + customTheme)
├── Tokens: colors (15), shadows (5), spacing (5)
└── API: getColor(), getShadow(), getSpacing(), setMode(), toggleMode(), setTheme()
```

### Integration Points

| Component | Role |
|-----------|------|
| `BootGate.svelte` | Injects CSS variables for login/error screens |
| `SideAppShell.svelte` | Injects CSS variables for authenticated app |
| `ThemeToggle.svelte` | UI control for mode switching |
| `LoginScreen.svelte` | Consumes CSS variables |

---

## Strengths

1. **Simple API** - Clear methods: `getColor()`, `getShadow()`, `toggleMode()`
2. **Svelte 5 idiomatic** - Proper use of `$state` + `$derived`
3. **Customization support** - `setTheme()` allows token overrides
4. **Well-structured tokens** - Clean separation: colors, shadows, spacing
5. **Merge strategy** - Custom themes extend base themes, not replace

---

## Issues

### 1. CSS Variable Injection Duplication

**Severity:** High

The same 14-line block is duplicated in:
- `BootGate.svelte` (lines 25-38)
- `SideAppShell.svelte` (lines 12-25)

```svelte
style:--background={themeService.getColor('background')}
style:--surface={themeService.getColor('surface')}
style:--surface-alt={themeService.getColor('surfaceAlt')}
...
```

**Impact:** Adding a new color token requires modifying multiple files. Maintenance burden increases with each new component needing theme vars.

### 2. No Persistence

**Severity:** Medium

```javascript
let mode = $state('dark')  // Lost on page refresh
```

User preference is not saved. Every session starts with dark mode regardless of previous choice.

### 3. No System Preference Detection

**Severity:** Medium

No support for `prefers-color-scheme` media query. Users with light mode OS see dark theme by default.

### 4. Hardcoded Default Mode

**Severity:** Low

```javascript
let mode = $state('dark')
```

Integrators cannot configure the initial mode. Some applications may prefer light as default.

### 5. Duplicated Spacing Tokens

**Severity:** Low

`lightTheme.spacing` and `darkTheme.spacing` are identical:

```javascript
spacing: {
  xs: '0.25rem',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem'
}
```

Unnecessary duplication. Spacing rarely changes between light/dark modes.

### 6. Indirect Reactivity Pattern

**Severity:** Low

```javascript
// ThemeToggle.svelte
let mode = $derived(themeService.mode)
```

Works because `$derived` re-evaluates, but fragile. Direct assignment loses reactivity:

```javascript
let bg = themeService.getColor('background')  // NOT reactive
```

---

## Recommendations

### R1: Centralize CSS Variable Injection

Create a single source for CSS variable generation:

**Option A: Helper function**
```javascript
// themeService
function getCssVars() {
  const t = currentTheme
  return {
    '--background': t.colors.background,
    '--surface': t.colors.surface,
    '--surface-alt': t.colors.surfaceAlt,
    // ...all tokens
  }
}
```

**Option B: ThemeProvider component**
```svelte
<!-- ThemeProvider.svelte -->
<div class="theme-root" style={themeService.cssVarsString}>
  {@render children?.()}
</div>
```

**Option C: Document-level injection**
```javascript
// Inject on <html> or <body> element
$effect(() => {
  for (const [key, value] of Object.entries(getCssVars())) {
    document.documentElement.style.setProperty(key, value)
  }
})
```

### R2: Add Persistence

```javascript
const STORAGE_KEY = 'side-theme-mode'

function initMode() {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && themes[stored]) return stored

  if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light'
  }
  return 'dark'
}

let mode = $state(initMode())

$effect(() => {
  localStorage.setItem(STORAGE_KEY, mode)
})
```

### R3: Support System Preference

```javascript
$effect(() => {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = (e) => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      mode = e.matches ? 'dark' : 'light'
    }
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
})
```

### R4: Configurable Default

```javascript
function configure(options) {
  if (options.defaultMode && themes[options.defaultMode]) {
    mode = options.defaultMode
  }
}

export const themeService = {
  // ...existing
  configure
}
```

### R5: Factor Out Spacing

```javascript
const baseTokens = {
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem'
  }
}

const lightTheme = {
  colors: { /* ... */ },
  shadows: { /* ... */ }
}

// Merge at runtime
let currentTheme = $derived({
  ...baseTokens,
  ...themes[mode],
  ...customTheme
})
```

---

## Priority

| Issue | Priority | Effort |
|-------|----------|--------|
| CSS var duplication | High | Medium |
| Persistence | Medium | Low |
| System preference | Medium | Low |
| Configurable default | Low | Low |
| Factor spacing | Low | Low |

**Recommended order:** R1 (duplication) → R2 (persistence) → R3 (system pref) → R4/R5
