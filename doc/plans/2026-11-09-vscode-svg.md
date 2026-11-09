# VS Code SVG extension implementation plan

**Goal:** Implement Phase 2 A.1–A.3 while preserving every Phase 1 CLI command. All SVG test fixtures live directly in `tests/assets/`.

**Approved architecture:** Extract only the generic XML DOM parsing stage from `SvgXmlCodec` into `src/infrastructure/svg/XmlParser.ts`. The extension reads the current `TextDocument`, adapts XML elements directly into native `DocumentSymbol` objects, and supplements source ranges inside the extension. Explorer badges use `FileDecorationProvider`. No CLI tree renderer, editing model, or command execution is involved in Outline.

**Stack:** TypeScript, existing xmldom parser, sax public source-position events, VS Code stable APIs, Node test runner, esbuild, and a real VS Code Extension Development Host.

## 1. Baseline and tests commit

- [x] Create branch `codex/vscode-svg`; run existing tests before changes: 167 passed.
- [x] Add fixtures directly under `tests/assets/`: CLI-compatible nested SVG; general SVG with unnamed elements/path/defs; incomplete XML; range edge cases with comments, CDATA, multiline tags, CRLF, Unicode, and self-closing elements.
- [x] Add Phase 1 regression tests with literal expected output and existing read/error/id semantics.
- [x] Add XML parser and source-position tests; run them before production modules exist and retain expected failure evidence.
- [x] Add real-host tests for native symbols, source ranges, unsaved edits, malformed XML recovery, badge/file-vs-directory behavior, cancellation, and source-file immutability.
- [x] Provide separate Phase 1 and plugin test commands and only the development dependencies needed to execute tests.
- [x] Review tests, then commit tests/fixtures/test infrastructure separately from production code.

## 2. Implementation

- [ ] Add `XmlParser.ts`: strict error reporting, original DOM, no CLI shape validation or generated ids. Update `SvgXmlCodec` to call it and preserve `EditorError('invalid SVG XML')` and every remaining validation.
- [ ] Add extension `SourceRangeIndex.ts`: use sax strict open/close events, preserve original UTF-16 offsets, match DOM elements in source order, key by DOM node identity, and provide full element/name ranges. Do not serialize XML to locate nodes.
- [ ] Add `SvgDocumentSymbolProvider.ts` and `SvgOutlineAdapter.ts`: read current text, preserve original labels/children, map ranges, return empty on incomplete XML/cancellation.
- [ ] Add `SvgFileDecorationProvider.ts`: `.svg` files only, async `workspace.fs.stat`, no propagation, undefined for directories/non-SVG/errors/cancellation.
- [ ] Add `extension.ts`, extension manifest, bundle build, independent typecheck, and F5 launch/tasks. Bundle runtime dependencies; do not impose CLI Node 24 requirement on the extension host.

## 3. Verification and code commit

- [ ] Run Phase 1 regression and full original suite separately from plugin unit and real-host suites.
- [ ] Run root/extension typechecks and CLI/extension production builds.
- [ ] Review requirements and code in separate read-only review passes; resolve findings.
- [ ] Write extension startup/test instructions, design-pattern/reuse analysis, and verification evidence.
- [ ] Commit implementation/configuration/documentation after green checks. Do not push, tag `p2`, or implement Phase 2 CLI plugins.

Source-range contract: offsets refer to the original buffer, end offsets are exclusive, `selectionRange` points to the opening tag name and is contained within `range`. Tests must exercise root/container/leaf nodes, missing ids, repeated ids, nesting, same-line elements, CRLF, and edits that are not saved.
