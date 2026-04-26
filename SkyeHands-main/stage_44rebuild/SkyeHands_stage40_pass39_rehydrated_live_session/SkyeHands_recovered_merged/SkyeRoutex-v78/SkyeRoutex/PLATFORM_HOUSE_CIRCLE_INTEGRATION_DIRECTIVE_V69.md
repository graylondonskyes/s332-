# PLATFORM HOUSE CIRCLE INTEGRATION DIRECTIVE V69

Reopen the project and integrate Neon as an **additional lane** without changing or breaking the shipped file-backed serverless persistence lane.

- Added optional Neon/Postgres helper library
- Added SQL schema for durable snapshots and replica event logs
- Added Netlify handlers for Neon health, backup push, and backup pull
- Added live shell Neon card/button and modal control surface
- Updated valuation and walkthrough to include the Neon lane

**Architectural posture**
- Primary lane stays: file-backed serverless persistence
- Additional lane added: Neon enterprise backup/restore lane
- No destructive replacement of shipped behavior
