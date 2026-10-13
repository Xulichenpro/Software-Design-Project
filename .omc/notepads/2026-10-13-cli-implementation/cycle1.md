# Cycle 1 receiver foundation

- RED: initial `npm test` failed three test files because ShapeTree, ShapeFactory and SvgXmlCodec did not exist. Test commit c1e329a.
- Additional XML regression rejected CLI-only text attribute after observing a missing-exception failure; test commit 77b9f6e.
- Feedback regression observed rect movement using delta instead of current position; test commit 5249830.
- GREEN: 32 tests pass; `npm run typecheck` exits 0. No standalone LSP diagnostic tool is exposed; TypeScript strict checking covers every source and test file.
- Edit receiver methods return EditOutcome for initial captures. Replaying move/scale/set invokes the same method and uses its result only. Replaying structure invokes editStructure(record.forward/inverse).
- Records freeze parameter objects and structural placement arrays. Placement records retain affected shape identity, original parent and sibling index; no document snapshot is stored.
- XML uses @xmldom/xmldom DOMParser/DOMImplementation/XMLSerializer after consulting the official repository README. ShapeFactory owns all tag-to-class dispatch.
- Document IO is asynchronous; geometry/queries/structure are synchronous. Three receivers share one ShapeTree; imported temporary tree replaces its contents.
- File writes use an exclusive temporary sibling, fsync, close, then rename; failures clean up temporary files and preserve document association.
