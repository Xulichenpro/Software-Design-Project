# Cycle 2 commands

- RED: `npm test` retained 32 foundation passes and failed the new command test file because the Command module was absent. Test commit 3a7ad59.
- GREEN: 49 total tests pass; `npm run typecheck` exits 0.
- Five abstract classes define ordinary, undoable, document barrier, query and typed target-control protocols; twenty concrete classes only forward requests to receivers or the supplied history target.
- Command<TInput = void> supports a common CommandResult | Promise<CommandResult> result; read/save retain asynchronous IO behavior.
- UndoableCommand owns its private EditRecord. A successful first execute saves it once; repeat execute/redo replay its forward parameters; undo replays inverse parameters. Failures leave the record intact.
- Request arrays and parameter objects are copied and frozen at construction. Replay returns receiver output while retaining the original saved record.
- UndoCommand/RedoCommand have no target field or executor dependency. execute(target) calls the supplied UndoableCommand, and getDirection supplies the abstract history direction.
- No command factory, executor or CLI has been implemented during this cycle.
