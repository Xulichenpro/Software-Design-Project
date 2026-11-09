/**
 * Test-only preload that makes `process.cwd()` point at a missing directory,
 * so the real `NodeDirectoryAdapter` rejects exactly like an unreadable cwd.
 * It is enabled only when SVG_TEST_FAILING_CWD is set; normal CLI runs are
 * completely unaffected.
 */
const failing = process.env.SVG_TEST_FAILING_CWD;
if (failing) {
  Object.defineProperty(process, 'cwd', { configurable: true, value: () => failing });
}

export {};
