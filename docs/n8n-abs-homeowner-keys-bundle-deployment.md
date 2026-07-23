# American Building Supply homeowner keys bundle

This patch is for the active n8n workflow `valtrim.inc App v2` (`6x9CMCsqkfxde7KZ`).

## Nodes to update

1. Open `Reconcile PDF vs QB V2` and replace its entire `jsCode` value with the contents of `n8n-reconcile-v2-code-node.js`.
2. Open `Build Final Clean JSON` and replace its entire `jsCode` value with the contents of `n8n-build-final-clean-json.js`.
3. In `AI Review Reconciliation`, keep the AI restriction that it must not create this grouping. The ABS bundle is resolved deterministically before AI review. The updated wording is in `n8n-reconcile-v2-ai-review-prompt.md`.
4. Save and publish the workflow without changing its connections, credentials, or webhook paths.

The repository versions before this patch were verified byte-for-byte against the corresponding active n8n Code nodes on July 22, 2026. Therefore the files above are direct replacements for those node bodies, with only the documented ABS bundle behavior added.

## Expected result for execution 765 / PO 33484

- PDF lines `13` (`CUT KEYS STANDARD`) and `12` (`SCH, KEYBLANK, 35-100C`) become one `MANY_PDF_TO_ONE_QB` row.
- Logical PDF quantity is `24`; the displayed source quantities remain `24, 24`.
- PDF line `12` uses its actual extended price of `$29.02`, so its effective unit price is `$29.02 / 24 = $1.2091667` (displayed as `$1.21`).
- Combined effective PDF unit price is `$1.20 + $1.2091667 = $2.4091667`; combined PDF total is `$28.80 + $29.02 = $57.82`.
- The row is paired with QuickBooks line `9`, `Schlage - Set of (4) Home Owners Keys`.
- The result is `MATCHED`, not a `PRICE_MISMATCH` or separate missing rows.

## Verification

Run locally:

```powershell
node docs/n8n-abs-homeowner-keys-bundle.test.cjs
```

Then force-reconcile PO `33484` through the normal upload flow. Confirm:

- `summary.abs_homeowner_keys_bundle_count` is `1`.
- `summary.pdf_not_in_qb` and `summary.qb_not_in_pdf` no longer include these key lines.
- The comparison table shows one Price Issue row with both PDF descriptions and allocations.
