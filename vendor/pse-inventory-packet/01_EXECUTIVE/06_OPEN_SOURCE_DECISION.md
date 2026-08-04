# Executive Open-Source Decision

- No OpenAI or proprietary LLM dependency.
- No AI in the publication, pricing, quantity, approval, hold or deployment path.
- PostgreSQL is the preferred production canonical store after the control-plane adapter passes staging gates.
- Python/FastAPI implements the deterministic publisher/API when an adapter is needed.
- Valkey is the preferred production shared-state service after the atomic nonce/rate-limit adapter passes multi-replica gates.
- Caddy provides TLS/reverse proxy.
- Prometheus, Alertmanager and Perses provide open observability.
- OpenAPI is an open standard, not OpenAI.
