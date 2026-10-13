# Cycle 6 bootstrap and real terminal

- RED: missing ApplicationBootstrap and NodeTerminal make two new suites fail while 153 earlier tests pass. Test commit 6d1b6ed.
- Final review regression RED 7f486cd reproduces six numeric/XML failures; fix f828442 prevalidates inverse geometry against original-relative tolerance, uses null-prototype imported attributes and preserves text CR as an XML character reference. Attribute LF/TAB/CR references already serialize safely via the XML library.
- GREEN: all 167 tests pass, strict `npm run typecheck` exits 0, and `npm run build` emits production-only JavaScript to ignored dist.
- ApplicationBootstrap builds exactly one shared ShapeTree, one shared ShapeFactory, all three receivers, codec/files, command factory, executor and CLI. Constructor defaults to NodeTerminal/NodeFileGateway and supports substitutable terminal/file injection.
- NodeTerminal registers line/close/error listeners immediately, buffers piped lines through EOF and IO waits, handles CRLF, split UTF-8 and unterminated final input, settles pending reads, and closes its readline interface.
- Consulted official [Node readline docs](https://nodejs.org/api/readline.html) for line/EOF/error events. Implementation buffers line events instead of using repeated question calls that can lose pre-delivered piped input.
- Acceptance child processes replay phase 6 and phase 6.1 version A, save/read real temporary SVGs, verify auto IDs/barriers, eight flowchart elements, Unicode and recovery after command/file failures. One acceptance subprocess invokes real npm run cli with the final tree line lacking a trailing newline.
- Separate manual smoke checks pass for npm run cli and node dist/bootstrap/main.js, including final tree output and undo restoration.
- No push or final tag is performed; final documentation and independent review remain with the main agent.
