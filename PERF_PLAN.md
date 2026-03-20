# Arrow Performance Plan

Date: March 16, 2026

## Goal

Arrow should deliver Solid-class performance without requiring a compile step.
That means the public runtime, used as ordinary Arrow, needs to compete on:

- initial create cost
- repeated update cost
- list diffing cost
- memory churn and GC pressure

## Benchmarking Rules

Performance claims must be honest.

- Benchmarks use the official `js-framework-benchmark` Arrow entries only.
- The local harness syncs this workspace's compiled runtime into those entries.
- No manual-DOM adapters.
- No benchmark-only DOM shortcuts outside the public Arrow runtime.
- Any benchmark-facing optimization must be a real Arrow feature or runtime behavior.

See [bench/js-framework-benchmark/README.md](/Users/justinschroeder/Projects/arrow/.dmux/worktrees/ssr-hydration/bench/js-framework-benchmark/README.md).

## Current Honest Baseline

Current branch-local runs using the official Arrow benchmark entries synced with
this workspace's compiled runtime:

- `01_run1k`
  - `solid-keyed`: `31.7 ms`
  - `vue-keyed`: `37.3 ms`
  - `vue-non-keyed`: `38.0 ms`
  - `arrow-non-keyed`: `41.7 ms`
  - `arrow-keyed`: `43.0 ms`
- `02_replace1k`
  - `vue-non-keyed`: `17.6 ms`
  - `arrow-non-keyed`: `23.3 ms`
  - `arrow-keyed`: `25.0 ms`
  - `solid-keyed`: `37.5 ms`
  - `vue-keyed`: `42.1 ms`
- `03_update10th1k_x16`
  - `solid-keyed`: `17.8 ms`
  - `arrow-keyed`: `20.2 ms`
  - `vue-keyed`: `20.7 ms`
  - `vue-non-keyed`: `22.4 ms`
  - `arrow-non-keyed`: `49.7 ms`

This says:

- create cost is the primary remaining gap
- keyed Arrow updates are already in striking distance
- non-keyed partial updates need dedicated work

## What Arrow Already Has

The core runtime still contains legitimate performance machinery:

- memory pooling
- template/chunk memoization
- keyed chunk reuse and movement
- stable component prop-box reuse
- fine-grained text/attr/event updates

Those features matter more on update paths than on `01_run1k`, which is why the create benchmark is still the most painful one.

## Working Hypothesis

The biggest losses versus Solid and Vue are in:

- watcher and binding allocation count during initial mount
- per-node event binding cost
- path-walk and node lookup cost while applying bindings to cloned templates
- closure creation inside repeated templates
- generic runtime branching in hot create paths

## Optimization Tracks

### 1. Event Handling

Goal: remove large volumes of per-node listener setup from hot create paths.

Candidates:

- internal delegated event handling for bubbling events
- shared listener stubs instead of fresh closure allocations where possible
- event argument forms that avoid userland per-row closures, for example tuple-style action binding

This is fair game because framework-internal delegation is allowed by the benchmark rules and useful in real apps.

### 2. Binding Creation

Goal: reduce the cost of mounting a cloned template instance.

Candidates:

- precompiled binding recipes per template shape
- faster binding target lookup than the current generic path walk
- pooled watcher/effect nodes
- fewer temporary arrays and sets during first mount

This is the most important track for `01_run1k` and `02_replace1k`.

### 3. List Rendering

Goal: make keyed and non-keyed list paths cheaper without turning Arrow into manual DOM code.

Candidates:

- lower-churn keyed bookkeeping during patch
- list-oriented fast paths for homogeneous template arrays
- reusable row/template instance pools
- better fragment batching when appending large runs of new children

### 4. Public Memo Primitives

Goal: expose real optimizations users can choose when they know a subtree is stable.

Candidates:

- template memoization API for repeated rows or branches
- keyed memo cells for stable list items
- component memo semantics for stable props

This is the Arrow equivalent of the rare but real `v-memo` class of optimization: explicit, honest, and available to users.

### 5. Reactive Runtime

Goal: cut observer overhead without weakening fine-grained semantics.

Candidates:

- smaller/faster dependency bookkeeping
- effect pooling
- cheaper computed invalidation paths
- less cleanup work on stable remount/reuse paths

## Novel Ideas Worth Exploring

These are still honest because they would be part of Arrow itself, not benchmark-only code.

- template-local memo cells: let a template remember the last inputs for a branch and skip deeper work when unchanged
- event tuples: `@click=${[select, row.id]}` to avoid closure allocation in repeated trees
- clone-time binding maps: pre-record the binding targets for a template and remap them linearly on clone
- row-view pools driven by template identity rather than handwritten DOM views

## Iteration Order

1. Keep benchmarks honest and branch-local.
2. Build an apples-to-apples Arrow benchmark trace against Solid and Vue on `01`, `02`, and `03`.
3. Attack event setup and binding creation first.
4. Re-run `smoke` and targeted `01/02/03` after each change.
5. Expand to `core` once a change survives correctness and size checks.
6. Only then widen to `targets` and `breadth`.

## Success Criteria

Short term:

- beat Vue 3 on most honest `core` benchmarks
- materially close the gap on `01_run1k`

Medium term:

- beat Vue 3 consistently
- trade with Solid on update-heavy cases

Long term:

- reach Solid-class results on the honest Arrow runtime without abandoning the no-build-step promise
