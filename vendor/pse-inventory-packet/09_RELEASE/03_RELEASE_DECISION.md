# Release Decision

**Packet decision:** `ENGINEERING_HANDOFF_READY`  
**Live production decision:** `PRODUCTION_NOT_DEPLOYED`  
**Release profile:** `OPEN_SOURCE_SUPER_GAUNTLET`  
**Packet version:** `4.0.0`  
**Contract/reference version:** `4.0.0`  
**OpenAPI syntax version:** `3.1.0`

## Approved scope

After the final release gauntlet passes, this packet is approved for engineering handoff, Phase 0 discovery, staging implementation and controlled production preparation. It contains deterministic contracts, tested reference behavior, an explicitly single-process runnable open-source stack, production adapter gates, operations controls and an executable release pipeline.

## Evidence authority

The exact current counts, test totals, visual parity, manifest size and tool versions are stored in `09_RELEASE/02_GAUNTLET_RESULTS.json`. That machine-readable result outranks remembered or copied counts in narrative documents.

## Detached clean-room evidence

The final deterministic ZIP hash, two clean extraction runs and rebuilt-ZIP comparison are recorded in the detached clean-room attestation distributed beside the packet. Keeping that attestation outside the packet avoids a self-referential archive hash.

## Truth boundary

This packet is not proof that `pilotsalesdistribution.com` has been modified. Production remains blocked until the website repository/hosting and authoritative SalesMax runtime/database are mounted, inspected, implemented, deployed and tested against the live acceptance gates.
