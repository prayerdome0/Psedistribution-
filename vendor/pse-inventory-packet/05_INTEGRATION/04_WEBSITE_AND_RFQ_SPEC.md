# Website and RFQ Integration Specification

## Catalog

- Render only current API records; stable URL uses slug.
- Search/category/MOQ/price filters appear only when backed by populated verified fields.
- Hide ratings, supplier-verification badges and unsupported testimonials/metrics until independently evidenced.
- Display last verified time, FOB, condition, MOQ, availability state, freight and inspection/return terms.
- RFQ/login mode never displays a fabricated price.

## RFQ

Prefill and preserve: Deal ID, slug, title, sourceVersion, snapshotVersion, desired quantity and referring URL. Validate quantity server-side. RFQ submission does not decrement inventory in Phase 1. Sales confirms availability and creates a controlled hold.

## Structured data

Generate Product/Offer JSON-LD from the same API record used for visible content. Do not output price when no public price exists. Escape all text in HTML contexts and allow only approved HTTPS asset hosts.

## Claims cleanup

Replace hard-coded marketplace counters and blanket shipping/return promises with feed-backed metrics and product-specific terms.
