# Admin Manual — Pilot Sales Distribution

This manual is for **store operators and content managers** who use the
admin dashboard at `/admin-dashboard`. It is **not** a developer guide
(see `DEVELOPER_GUIDE.md` for that). For production operations see
`OPERATOR_RUNBOOK.md`.

---

## 1. Signing in

1. Navigate to <https://pilotsalesdistribution.com/login>.
2. Enter the email address and password that the operator provisioned for
   you. **Sellers** are sent to `/seller-dashboard` after login;
   **admins** are sent to `/admin-dashboard`; everyone else lands on the
   homepage.
3. If you forgot your password, click "Forgot password?" on the login
   page or go directly to `/forgot-password`.

> **Security:** the dashboard URL is intentionally not advertised on the
> site. Never share the link publicly. All admin actions are recorded in
> the `audit_log` Firestore collection (visible to other admins under
> Audit Logs).

---

## 2. Dashboard overview

The opening screen summarises four health signals:

| Card | What it shows | What to do if it's red |
|---|---|---|
| Open RFQs | Quotes awaiting your reply | Click the card to triage |
| Low stock | Products with `qty <= reorder_point` | Click to restock or delist |
| New users | Sign-ups in the last 7 days | Spot check for abuse |
| Active orders | Orders in `processing` or `awaiting_shipment` | Click to fulfil |

The same numbers are mirrored in the **Sales reports** screen, where
they are filterable by date range.

---

## 3. Product management

### Add a product (manual)

1. Go to **Products → Add product**.
2. Fill in the required fields:
   - **Title** (max 200 chars), **SKU** (unique, max 64 chars), **Category**.
   - **Description** (HTML allowed, sanitised server-side — no `<script>`).
   - **Price**, **MOQ** (minimum order quantity), **Lead time** (days).
   - **Stock** (live-quantity — see Inventory below), **Status**
     (`draft`, `active`, `out_of_stock`, `archived`).
3. Upload images. Drag-and-drop, max 8 images, 5 MB each, `image/webp`
   preferred. The first image becomes the card thumbnail.
4. Click **Save as draft** to preview, or **Publish** to make the
   product visible to buyers. Drafts do not appear in the public API.

### Bulk import (CSV / Excel)

1. Download the template from **Products → Bulk import → Download template**.
2. Fill the spreadsheet. Required columns: `sku,title,category,price,moq,stock,lead_time_days`.
3. Upload the file. The importer validates every row, reports row
   numbers with errors, and **does not write anything** until the
   preview is approved.
4. Click **Apply** to commit. The operation is atomic — if any row
   fails, the whole batch is rolled back and the database is unchanged.

The template and import format are documented in
`pse_wholesale_products_template.csv` at the repo root.

### Edit / archive

- **Edit** opens the same form pre-filled. Changes to `price` and
  `stock` are timestamped in the `inventory_history` collection.
- **Archive** sets `status = archived` and removes the product from
  public search. Existing carts and RFQs are preserved. You can
  restore an archived product from the same screen.

---

## 4. Inventory management

Live inventory is the source of truth for stock. Edits here propagate
to the storefront within a few seconds.

| Action | Where | Notes |
|---|---|---|
| Adjust stock for one product | Products → Edit → Stock tab | Each change is timestamped + reason-coded (`received`, `sold`, `damaged`, `manual_adjust`) |
| Receive a shipment | Inventory → Receive | Scans a PO and adds the quantity atomically |
| Reserve stock for an order | Inventory → Reservations | Reserved stock is invisible to new buyers until released or fulfilled |
| Batch import (CSV) | Inventory → Import | Same template as products, but with `stock,qty_reserved,reorder_point` columns |
| View history | Inventory → History | Every change with operator, timestamp, before/after, reason |

### Low-stock alerts

When `stock <= reorder_point` the product card turns amber in the
dashboard. To turn alerts into email/Slack notifications, set the
**Alert webhook** under Settings → Notifications.

---

## 5. Categories, brands, suppliers, warehouses

These are simple CRUD screens under their respective top-level menu
items. Important rules:

- **Categories** are a 2-level tree. Promoting a leaf to a parent
  preserves the slug but rewrites parent slugs in URLs. Plan first.
- **Brands** are a flat list with logo + verification state. Only
  verified brands appear in the public filter.
- **Suppliers** are *external* sellers. Each supplier has a contact,
  verification status, and a list of products they supply.
- **Warehouses** have a code, address, and the freight zones they ship
  to. Used by the freight estimator on the RFQ page.

---

## 6. RFQ management

The Request-for-Quote workflow has five states. Triage them from the
**RFQs** screen.

```
new → in_review → quoted → accepted → fulfilled
                     ↓
                  declined / expired
```

1. **new** — buyer just submitted. Respond within 1 business day.
2. **in_review** — you've opened it. Click **Create quote** to
   attach pricing. The quote PDF is generated automatically from
   the line items.
3. **quoted** — buyer has the PDF and can accept, decline, or comment.
4. **accepted** — convert the accepted quote to an order from the
   same screen (button: **Create order from quote**).
5. **fulfilled** — order has shipped.

### Sales team assignment

Each RFQ has an `assigned_to` field. The assignee sees the RFQ in
**My queue**. Reassign by clicking the avatar on the RFQ detail
screen — useful for shift handovers.

### Buyer comments

Buyers can post comments on their own RFQ. They appear inline on the
admin RFQ detail screen and trigger an in-app notification to the
assignee.

---

## 7. Customer management

The **Customers** screen lists all signed-in users with their order
history, RFQ history, total spend, and verification status.

- **Verify** — promotes a buyer to `verified` after KYC. Verified
  buyers unlock Net-30 terms (UI-only — payment integration required
  to actually bill on terms).
- **Suspend** — sets `status = suspended`. Suspended users cannot sign
  in or submit RFQs. Their existing orders still resolve.
- **Reset MFA** — clears TOTP enrolment and forces re-enrolment on
  next sign-in.

---

## 8. User roles & permissions

Three built-in roles, plus the **custom roles** editor under
Settings → Roles.

| Role | Can | Cannot |
|---|---|---|
| **buyer** | Browse, RFQ, order, comment | Edit any product, view other users |
| **seller** | Manage their own products + RFQs assigned to them | Edit other sellers' products, view admin settings |
| **admin** | Everything in this manual | (none within the dashboard) |

**Custom roles** are subsets of `admin`. Create one to delegate, e.g.,
"fulfilment agent" who can move orders but not edit prices.

---

## 9. Sales reports

Pre-built reports at **Reports → Sales**:

- Revenue by day / week / month
- Top 20 products by units and by revenue
- RFQ conversion funnel
- Customer cohorts
- Supplier performance

All reports are exportable as CSV. Date range is required; leave the
defaults for "last 30 days".

---

## 10. Analytics

**Analytics** is the same data exposed in real-time. Use it for
operational decisions (e.g. "is this promotion driving add-to-carts?")
rather than financial reporting (use the **Sales reports** screen for
that).

---

## 11. CMS — homepage content

The homepage is composed of **blocks** under **CMS → Homepage**.
The blocks in order (top to bottom) are:

1. Hero banner
2. Trust strip (verified suppliers, escrow, freight, etc.)
3. Live inventory strip
4. Category tiles
5. Featured deals
6. Brand logos
7. How it works (3 steps)
8. Testimonials
9. CTA strip
10. Footer (separate screen)

Each block is **reorderable** (drag the handle on the left of each
card), **deletable** (with confirmation), and **editable inline**
(click the pencil icon).

> **Tip:** Preview before publishing. Every block has an eye icon that
> toggles a sandboxed preview at the top of the page. When you're
> happy, click **Publish** in the top-right — the change is live within
> 60 seconds (cache TTL).

---

## 12. System settings

**Settings → System** holds:

- **Site name, logo, favicon** — visible everywhere
- **Currency selector** — toggles the user-facing currency list and
  default. The conversion rates are read from Settings → FX and
  refreshed every 6 hours from the configured source.
- **Email sender** — `From:` address and reply-to for transactional
  email. Must be verified with the email provider before use.
- **ReCAPTCHA** — site key + secret. Required to enable the bot
  shield on the contact and RFQ forms.
- **API rate limits** — coarse override on the inventory API. The
  hard limit lives in the inventory container; this is a soft hint.

---

## 13. Audit logs

Every write to the database from the dashboard is logged in
`audit_log` with:

- `actor` (user id, email, role)
- `action` (e.g. `product.update`, `rfq.quote.create`)
- `resource` (collection + doc id)
- `before` / `after` (diffed, sensitive fields redacted)
- `ip` (last 3 octets only — for privacy)
- `ua` (browser + OS)

Logs are **append-only**. They are not editable from the dashboard —
even admins cannot alter history. Retention is 13 months (configurable
under Settings → Compliance).

Export the full log as CSV from the **Audit logs** screen (top-right
button → "Export range").

---

## 14. Getting help

| Question | Where to look |
|---|---|
| How do I bulk-update prices? | Products → Bulk edit (top-right) |
| How do I refund an order? | Orders → select order → Refund |
| Why is a product not showing on the site? | CMS → Status of the product. If `active`, check Inventory → Live snapshot to see if it's in the public feed. |
| How do I add a new admin? | Settings → Team → Invite. They receive an email with a one-time link valid for 24 hours. |
| The inventory feed is stale | Run **Settings → Inventory → Validate now**. If that doesn't help, escalate using the runbook. |
| A buyer is abusive in chat | Customers → select user → Suspend. Also visible in Audit logs. |

If the answer isn't in the manual, contact the operator team. The
operator on-call rotation is in `OPERATOR_RUNBOOK.md`.
