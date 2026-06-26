# Code Style

## Functional Programming

- Prefer functional style: pure functions, immutable data, expressions over statements
- Small, single-purpose functions — if a function does more than one thing, split it
- `const` everywhere; never use `let` unless mutation is genuinely unavoidable, never use `var`
- `readonly` on all type properties, function parameters, and array types (`readonly T[]`); exception: a mutable array used as a local accumulator within a single function body (built with `.push()`, never returned or exposed as mutable) is acceptable when the immutable alternative would cause repeated full-array copies — e.g. `[...acc, item]` inside a loop or recursion allocates a new array on every iteration (O(n) per step), whereas `.push()` is O(1) amortised
- Avoid side effects — functions should return values, not mutate external state
- Prefer `map`, `filter`, `reduce`, and other higher-order functions over imperative loops
- Prefer early returns over nested conditionals

## File Organization

- Order members within a file top-to-bottom by kind:
  1. `import`s
  2. `type` / `interface` declarations
  3. `const`s and other module-level configuration/values
  4. exported functions and other exported members
  5. non-exported (private) helpers and members last
- Place an exported function above the private helpers it relies on (the helpers sit in the final group); module-level `const` arrow functions are only invoked at call time, so a later definition is fine at runtime.

## Comments

- Only add comments that carry meaningful, non-obvious information. If a function or
  block is self-explanatory, leave it uncommented.
- Strive to make the code itself self-explanatory (clear names, small functions) so that
  comments are rarely needed in the first place.
- Reserve comments for special situations the code cannot convey on its own: *why* a
  non-obvious choice was made, workarounds, gotchas, invariants, or surprising edge cases —
  not *what* the code is doing.

## Libraries

- Use **ts-pattern** for non-trivial `switch`/`if-else` chains — anything beyond a simple 2-branch condition should use `match()` from `ts-pattern`
- Use **Zod** to define schemas for all API response payloads and API endpoint inputs — the Zod schema is the source of truth; TypeScript types are always derived via `z.infer<>`, never written by hand alongside a schema

## Exports

- All API queries and API-related models must be exported from `lib/public_api.ts` — nothing is part of the public API unless it appears there

# Tooling

- After making code changes, run `pnpm run biome:fix` to auto-format and fix lint issues
