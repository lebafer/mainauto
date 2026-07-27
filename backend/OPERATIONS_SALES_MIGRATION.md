# Sales accounting migration preflight

Run this read-only check against the production database before applying
`20260727120000_sales_invoice_integrity`:

```sh
bun run migration:preflight-sales
```

Archive the JSON output with the deployment record. The script never changes data.

- `duplicateSales` blocks the migration because the new partial unique index permits
  only one completed sale per vehicle.
- `soldWithoutSale` and `saleWithUnsoldVehicle` require a business-owner decision.
  Do not infer or change vehicle status automatically.
- `regularTaxedLegacySales` must be reviewed as gross versus net. The migration marks
  these rows `legacy_ambiguous` and leaves gross/net/tax snapshots empty. They are
  excluded from accounting totals and invoice creation until an explicit,
  separately reviewed reconciliation sets the cents snapshots and status.
- Every legacy sale is marked `legacy_ambiguous`; the editable current vehicle tax
  mode is never used as historic evidence. An owner/admin must explicitly confirm
  regular versus margin taxation and, for regular taxation, gross versus net price.
  The frozen purchase/cost values are only a review starting point.

Back up the database, run the preflight, resolve duplicate sales if any, apply the
migration, then compare sale counts and finance warning counts. Never run a bulk
status correction without dealership approval.

The §25a calculation, invoice wording, retention periods, cancellation workflow and
any future correction-document workflow must be reviewed by the dealership's German
tax adviser before production use.
