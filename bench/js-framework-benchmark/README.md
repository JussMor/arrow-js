# Benchmark Policy

Arrow benchmark claims must be backed by the official `js-framework-benchmark`
Arrow entries:

- `frameworks/keyed/arrowjs`
- `frameworks/non-keyed/arrowjs`

The local harness syncs this workspace's compiled runtime into those official
entries before every run. That means benchmark results reflect the current
branch's real shipped Arrow build, not a benchmark-only adapter.

Non-negotiables:

- No manual DOM implementations presented as Arrow results.
- No benchmark-only side channels that bypass the public Arrow runtime.
- No direct DOM mutation in benchmark apps beyond what the public Arrow runtime
  does internally.
- Any optimization used in the benchmark app must be a real Arrow feature that
  users can employ in production code.

Allowed work:

- Runtime optimizations inside Arrow itself.
- Public API additions that users can actually adopt, such as memoization or
  lower-allocation event patterns.
- Benchmark app improvements only when they use public Arrow APIs and remain
  readable as normal Arrow code.
