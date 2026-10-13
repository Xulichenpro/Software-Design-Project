# Cycle 3 command factory

- Preliminary formatting fix 06d3ee2 removes redundant EOF blank lines from foundation/command source; `git diff --check a526fca HEAD` is clean.
- RED: 49 prior tests pass while new factory suite fails because CommandFactory is absent. Test commit 7d2dd8b.
- Type-safe test refinement 6e35959 narrows history controls before ordinary no-target execute. Required HistoryControlCommand target parameters remain unchanged.
- GREEN: 118 cumulative tests pass; strict `npm run typecheck` exits 0.
- ArgumentToken and ParsedCommandLine are readonly input contracts retaining quote metadata. Factory creates and binds all twenty commands, validates command arities and generic numeric parameters, and performs no shape-tag dispatch.
- init accepts zero, one or two dimensions; canvas accepts zero or two. Help can be constructed and executed before initialization.
- Unquoted trailing in clauses are stripped from create parameters. Quoted in/content ending in remain literal text. Optional quote flags pass through CreateCommand and ShapeEditorReceiver to the existing ShapeFactory text dispatch branch, where quoted text and shape-specific arguments are validated.
- CommandFactory returns Command<void> | HistoryControlCommand. Callers must narrow the target-control category before invoking execute.
- No executor, parser, application or bootstrap has been implemented during this cycle.
