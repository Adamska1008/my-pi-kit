# Examples

These are fictional teaching examples, not claims about a user's repository. In a real review, replace every anchor with inspected source and the actual revision. Evidence IDs are local to each review.

## A. Boundary condition: no diagram

Scope: committed base `<base>` → head `<head>`, one function inspected with its caller and boundary tests.

| Before | After | Evidence |
| --- | --- | --- |
| A token with `expiresAt === now` is accepted | That token is rejected | E1 |

```diff
- if (expiresAt < now) reject();
+ if (expiresAt <= now) reject();
```

E1: `src/auth/token.ts:24–27`, `validateToken`, base/head respectively (verify each version's lines).

Where to inspect: Does the token contract define expiry as inclusive or exclusive? Check the equality case and the clock units used by the caller. This condition does not establish behavior for missing or malformed expiry values.

Validation: boundary test asserts equality rejection; tests not run. No diagram: the changed predicate explains the delta more directly.

## B. Cache fallback: include unchanged writes

Scope: base → head, changed read path and its unchanged write path inspected.

| Relation | Before | After | Evidence |
| --- | --- | --- | --- |
| `getUser` reads cache | Absent | Added; hit returns cached user | E1 |
| `getUser` reads DB | Every call | Cache miss only | E1, E2 |
| `getUser` writes cache | Absent | After DB read | E1 |
| `updateUser` invalidates cache | Absent | Still absent in the inspected write path | E3 |

A focused flow diagram can show `getUser → cache lookup → hit/miss`, and the miss path's DB read and cache write. Label those edges "reads" or "writes", not simply arrows. Show unchanged `updateUser → DB write` as context. Do not assert that it invalidates the cache.

Evidence:
- E1: changed `getUser` body at the inspected head.
- E2: DB adapter and return/error contract at the inspected head.
- E3: unchanged `updateUser` body and checked call sites at the inspected head.

Where to inspect: If a cached user is updated, how long can reads return the old value? Inspect TTL and other invalidation mechanisms before claiming a defect. "No invalidation in this function" is not "no invalidation anywhere".

Validation: cache hit/miss tests exist; update-then-read coverage not found in inspected tests. Tests not run. Inferred intent: reduce repeated DB reads.

## C. Pure module move: avoid invented behavior

Scope: base → head, exported function moved from `auth.ts` to `token.ts`, affected imports inspected.

| Concern | Observed delta | Evidence |
| --- | --- | --- |
| Implementation | Body unchanged after normalizing the move | E1 |
| Internal consumers | Import path changed | E2 |
| Public entry point | Old export removed | E3 |

Evidence IDs must identify base and head symbols, callers, and the public export surface.

Do not summarize this as "behavior preserved" just because the function body is identical. Public import compatibility may have changed. If a re-export keeps compatibility, inspect it and say which consumers are covered.

Where to inspect: Is the old import path part of the supported public API? Are there consumers outside this repository?

Validation: implementation comparison inspected; no external-consumer evidence and tests not run. A table is sufficient; a structure diagram is optional if many ownership boundaries moved.
