# VS Code extension TDD evidence

Date: 2026-11-09. Baseline: `f3311ea`. Working branch: `codex/vscode-svg`.

## Tests-first checkpoint

No production module was added or modified before this checkpoint.

| Command | Result before implementation |
| --- | --- |
| Original `npm test` at baseline | 167 passed, 0 failed |
| `npm run test:phase1` with four new compatibility tests | 171 passed, 0 failed |
| `npm run test:plugin:unit` | Expected failure: `XmlParser` production module does not exist yet |

The plugin unit suite defines 11 cases for XML preservation/error handling and original-buffer source ranges. The real VS Code suite defines 15 cases for extension registration, native symbols, unsaved edits, invalid XML recovery, source positions, file decorations, cancellation, and file immutability. Real-host tests require the production modules and extension bundle and will run after implementation.

Every committed SVG fixture lives directly in `tests/assets/`. The CRLF fixture has an explicit Git attribute to preserve its exact line endings. Existing Phase 1 tests and inline inputs are retained unchanged.

The first commit contains tests, fixtures, test tooling/development dependencies, and this checkpoint. Production implementation follows in a separate commit.

## Implementation verification

| Command | Final result |
| --- | --- |
| `npm run test:phase1` | 171 passed, 0 failed (original 167 plus 4 compatibility cases) |
| `npm run test:plugin:unit` | 11 passed, 0 failed |
| `npm run test:plugin:host` | 15 passed, 0 failed in real VS Code 1.145.2 |
| `npm test` | All three groups above passed together |
| `npm run typecheck` | Passed |
| `npm run typecheck:extension` | Passed |
| `npm run build` | Passed |
| `npm run build:extension` | Passed |

The installed VS Code 1.145.0 entered an updater mutex during verification. Final host runs used the official isolated 1.145.2 download with `VSCODE_TEST_DOWNLOAD=1`; no installed application files were modified. VS Code itself emitted proposal/deprecation messages, but the host test process exited with code 0.

## Checks and corrections during AI collaboration

1. The original CLI tree output contains ASCII strings rather than source nodes. The approved design therefore reuses the XML parsing stage and adapts original DOM elements directly, without changing the CLI renderer or creating a new tree-rendering framework.
2. The first host run passed 13/15 tests. The host symbol-query command returns `undefined` for no symbols, although the provider itself returns `[]`. The test helper was corrected to normalize the command result, and a direct provider empty-array assertion was retained. The correction belongs to the tests commit, not the production commit.
3. Type checking exposed nullable `documentElement` in the generic library type. `XmlParser` now validates that a parsed document has a root before returning its non-null contract.
4. The user's actual screenshot showed an SVG Image Preview, whose active editor cannot provide a text Outline. The sample workspace now associates SVG with the default text editor; existing preview tabs must be reopened using **Reopen Editor With → Text Editor**.

Tests/fixtures/tooling and production code remain in separate commits. Independent requirements and code-quality reviews both approved the implementation.

## Visual evidence

[Explorer SVG badges](images/svg-badges.png) is the user's real development-host screenshot. It also demonstrates why the Image Preview editor has no text Outline. [Text-editor Outline](images/svg-outline.png) is the user's subsequent real screenshot: it shows `svg → g#same → rect#same` and the separate unnamed sibling `rect`, alongside the original source. All elements in this fixture share line 1; their column ranges differ. Automated native-symbol tests verify the exact hierarchy and selection ranges.

Automatic screenshot capture was blocked by a Windows UI connector window-identity error. Both visual artifacts above came directly from the user's actual development host, with no fabricated UI.
