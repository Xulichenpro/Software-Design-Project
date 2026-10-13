# Cycle 5 CLI application

- Preliminary regression 8948e84 observes no-document controls incorrectly returning empty-history errors; fix d981258 tracks document establishment only after successful abstract edit/barrier execution, without receiver/domain dependencies.
- RED: new CLI modules are absent; cumulative prior 130 tests pass and three CLI test files fail. Test commit 8cd1f77.
- GREEN: 153 cumulative tests pass; strict typecheck exits 0.
- Parser freezes input/tokens, retains quoted flags and empty text, supports quote/backslash escapes inside quotes, preserves unquoted Windows path backslashes, and only skips whole-line leading-hash comments.
- Quoted command names, unterminated quotes, unsupported quoted escapes and adjacent unseparated quoted/unquoted fragments are rejected to avoid ambiguous token concatenation.
- Terminal interface has async readLine(prompt), writeLine and close. CliApplication reads one line at a time and awaits factory/executor processing before its next read; renderer handles one sanitized error line and warnings with one prefix. Finally always closes the terminal.
- Tests verify startup banner, prompts, EOF, error recovery, quote/escape handling end to end, imported ID warnings and delayed save input ordering using substitutable terminals/files.
- CLI source only depends on factory/execution/contracts and other CLI classes. No NodeTerminal or bootstrap implementation is included yet.
