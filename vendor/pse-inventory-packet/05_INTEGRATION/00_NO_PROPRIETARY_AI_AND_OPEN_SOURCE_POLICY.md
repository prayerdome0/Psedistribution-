# No Proprietary AI and Open-Source Runtime Policy

## Decision

The inventory publication system does not require a language model. Production approval and publication are deterministic and evidence-based.

## Prohibited production dependencies

- OpenAI API, ChatGPT, Codex, or any proprietary hosted LLM in the inventory publication path.
- Any AI-generated quantity, availability, UPC, price, freight term, expiration date, source evidence, approval or hold.
- Any model with authority to publish, commit inventory, change price, create a hold, or release a deployment.
- Any runtime dependency whose license is source-available but not OSI-approved, unless the owner explicitly approves an exception after legal and operational review.

## Optional future local AI boundary

A separately approved, locally hosted, appropriately licensed model may later suggest category tags or draft descriptions. Suggestions must remain non-authoritative, must not receive private data beyond its approved scope, and must pass human review and all deterministic contracts before publication. It is not part of this release.

## Enforcement

The packet gauntlet scans code, configuration, environment templates, manifests and dependency files for proprietary-AI integrations and fails closed on prohibited indicators.
