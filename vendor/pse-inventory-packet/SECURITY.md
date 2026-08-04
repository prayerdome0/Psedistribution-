# Security Policy

## Supported packet line

Security corrections are accepted for the current `4.x` packet line. Older
packet releases are historical evidence only and must not be promoted without
rerunning the current gauntlet.

## Reporting a vulnerability

Report suspected vulnerabilities privately to the authorized PSE engineering
owner or system administrator. Do not place credentials, private inventory,
supplier identity, acquisition cost, proof files, customer information, or
exploit details in public issues or shared screenshots.

Include the affected packet version, file or endpoint, reproduction steps,
impact, and any safe evidence. Preserve logs and hashes. Do not test against the
live website, SalesMax runtime, suppliers, or customers without written
permission.

## Response expectations

The release controller will classify the report, preserve evidence, reproduce
it in an isolated environment, add a failing regression test, implement the
smallest root-cause correction, rerun the full gauntlet, and issue a new signed
release. Production remains blocked until the live deployment receives the
same correction and acceptance tests.
