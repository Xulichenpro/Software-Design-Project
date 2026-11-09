# Phase 2 acceptance fixes

Goal: fix the audited failures without changing the approved Registry/ShapeProvider/PluginCommand architecture; retain `final` and, per the user's latest explicit instruction, replace the old `p2` with the verified final repair commit.

1. Loader/assembly: add failing tests for relative-config bare packages, config-mode isolation, and malformed manifest contributions; minimally repair existing bootstrap/loader/host methods.
2. State/transactions: add failing tests for root child reorder dirty tracking, handler result materialization failure, and partially failing patch replay; repair the existing snapshot/transaction boundaries. Enforce the declared box title quoting contract.
3. Metrics: test historical endpoints independently of the working tree and distinguish TypeScript syntax from executable branches; use the installed TypeScript AST, Git blobs, and reproducible CLI options.
4. Acceptance evidence: persist Phase 1, box, and plugin transcript inputs/expected output/assets; compare actual `final` against the no-plugin runtime and A/B sessions. Create a truthful configuration-only box demonstration branch based on the original pre-box commit, without changing existing runtime source.
5. Verify: targeted RED/GREEN evidence, full CLI/plugin suites, both strict type checks, both builds, actual VSCode host tests, independent spec and code review. Update verification/metrics from real output.
6. Release: commit repair groups, generate committed historical reports, fast-forward master, recreate annotated `p2`, push master/tag/demo branch, and verify remote commit IDs. The user explicitly authorized replacing only `p2`; guard its remote update with the observed old tag object, and never force-update other refs.

Ownership: worker A owns bootstrap/loader/host and their regression tests; worker B owns snapshot/event/attribute/box validation fixes and their tests; worker C owns metrics script/tests. Primary agent owns transcript evidence, documentation, integration, commits, and release. Workers share the worktree and must preserve each other's edits.
