# AE Platform Recovery Directive (2026-04-16)

## Objective
Recover and harden missing AE platform runtime scaffolding discovered during code-based smoke execution.

## Immediate implementation scope
1. Recreate missing `netlify/functions` runtime surface expected by AE smoke.
2. Recreate shared helpers under `netlify/functions/_shared`.
3. Add baseline DB schema placeholders for required tables.
4. Add root launcher scaffolding (`assets/`, `pages/`, `docs/`) required by smoke wiring checks.
5. Ensure all new JS files pass syntax checks.

## Notes
- These implementations are foundational scaffolds to unblock smoke/runtime references.
- Follow-up passes should replace placeholders with production-grade persistence/auth/LLM calls.
