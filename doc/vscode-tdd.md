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
