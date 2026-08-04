# License and Supply-Chain Policy

## Default rule

Production dependencies must be open source under an OSI-approved license. Permissive licenses such as Apache-2.0, MIT, BSD and PostgreSQL are preferred.

## Required controls

- Maintain a dependency and license register.
- Pin exact versions and immutable container digests.
- Generate an SBOM for every promoted build.
- Scan for known vulnerabilities and prohibited licenses.
- Preserve upstream source, checksums, license notices and build provenance.
- Do not use source-available software as an open-source substitute without explicit approval.
- Review AGPL/GPL obligations before modifying or distributing covered components.
- Re-run contract, security, license and clean-room checks after every dependency upgrade.

## AI boundary

No proprietary AI SDK, endpoint, model key or hosted LLM may enter the critical inventory path. Optional future local AI requires a separate approved component/license record and remains advisory only.
