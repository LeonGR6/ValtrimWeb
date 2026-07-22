# n8n QuickBooks PO line update

Workflow: `valtrim.inc Pruebas Andres Front`

Existing trigger: `Update-qb-po-line`

Production URL:

```text
POST https://n8n.valtrim.cloud/webhook/update-qb-po-line
```

Expected request body:

```json
{
  "po_number": "33308",
  "qb_line": 5,
  "current_qty": 1,
  "current_rate": 65.83,
  "next_qty": 1,
  "next_rate": 62.83,
  "qb_description": "..."
}
```

## Node Chain

Connect the existing `Update-qb-po-line` webhook to these nodes:

```text
Update-qb-po-line
 -> Validate QB Line Update Request
 -> Query QuickBooks PO for Update
 -> Build QuickBooks PO Update Payload
 -> Update QuickBooks Purchase Order
 -> Build QB Line Update Response
 -> Respond to QB Line Update
```

Set the webhook `responseMode` to `responseNode` so the last node can return JSON to the frontend.

## Validate QB Line Update Request

Node type: `Code`

```js
const input = $input.first();
const body = input.json.body || input.json || {};

function requiredString(value, field) {
  const text = String(value ?? '').trim();
  if (!text) {
    throw new Error(`${field} is required.`);
  }
  return text;
}

function requiredNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${field} must be a number.`);
  }
  return number;
}

function money(value) {
  return Math.round(requiredNumber(value, 'money') * 100) / 100;
}

function escapeQboQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const poNumber = requiredString(body.po_number, 'po_number');
const qbLine = requiredNumber(body.qb_line, 'qb_line');
const currentQty = requiredNumber(body.current_qty, 'current_qty');
const currentRate = money(body.current_rate);
const nextQty = requiredNumber(body.next_qty, 'next_qty');
const nextRate = money(body.next_rate);

if (qbLine <= 0) {
  throw new Error('qb_line must be greater than 0.');
}

if (currentQty < 0 || nextQty < 0 || currentRate < 0 || nextRate < 0) {
  throw new Error('Quantity and rate values cannot be negative.');
}

return [{
  json: {
    po_number: poNumber,
    qb_line: qbLine,
    current_qty: currentQty,
    current_rate: currentRate,
    next_qty: nextQty,
    next_rate: nextRate,
    next_amount: money(nextQty * nextRate),
    qb_description: String(body.qb_description || '').trim(),
    qb_query: `select * from PurchaseOrder where DocNumber = '${escapeQboQueryValue(poNumber)}'`
  }
}];
```

## Query QuickBooks PO for Update

Node type: `HTTP Request`

Use the same QuickBooks credential used by the existing `Query QuickBooks Purchase Order1` node.

Settings:

```text
Method: GET
URL: https://quickbooks.api.intuit.com/v3/company/123145849597027/query
Authentication: Predefined Credential Type
Credential Type: quickBooksOAuth2Api
Query:
  query = {{ $json.qb_query }}
  minorversion = 75
Headers:
  Accept = application/json
  Content-Type = application/text
Options:
  Timeout = 30000
```

## Build QuickBooks PO Update Payload

Node type: `Code`

```js
const queryResponse = $input.first().json;
const request = $('Validate QB Line Update Request').item.json;

const po = queryResponse.QueryResponse?.PurchaseOrder?.[0];

function toNumber(value) {
  const number = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function valuesMatch(a, b, tolerance = 0.0001) {
  return Math.abs(toNumber(a) - toNumber(b)) <= tolerance;
}

function moneyMatch(a, b) {
  return valuesMatch(a, b, 0.05);
}

if (!po) {
  throw new Error(`Purchase Order ${request.po_number} was not found in QuickBooks.`);
}

const lines = Array.isArray(po.Line) ? po.Line : [];
const targetLine = lines.find((line) => Number(line.LineNum) === Number(request.qb_line));

if (!targetLine) {
  throw new Error(`LineNum ${request.qb_line} was not found in QuickBooks PO ${request.po_number}.`);
}

const detail = targetLine.ItemBasedExpenseLineDetail || targetLine.PurchaseOrderItemLineDetail;

if (!detail) {
  throw new Error(`LineNum ${request.qb_line} is not an item-based purchase order line.`);
}

const existingQty = toNumber(detail.Qty);
const existingRate = toNumber(detail.UnitPrice ?? detail.Rate);

if (!valuesMatch(existingQty, request.current_qty)) {
  if (valuesMatch(existingQty, request.next_qty) && moneyMatch(existingRate, request.next_rate)) {
    return [{
      json: {
        already_updated: true,
        po_number: request.po_number,
        qb_line: request.qb_line,
        previous_qty: existingQty,
        previous_rate: roundMoney(existingRate),
        next_qty: request.next_qty,
        next_rate: request.next_rate,
        next_amount: roundMoney(existingQty * existingRate),
        qb_purchase_order_id: po.Id,
        sync_token: po.SyncToken,
        update_payload: {
          ...po,
          sparse: false,
          Line: lines,
        }
      }
    }];
  }

  throw new Error(`QuickBooks quantity changed from ${request.current_qty} to ${existingQty}. Refresh before saving.`);
}

if (!moneyMatch(existingRate, request.current_rate)) {
  if (valuesMatch(existingQty, request.next_qty) && moneyMatch(existingRate, request.next_rate)) {
    return [{
      json: {
        already_updated: true,
        po_number: request.po_number,
        qb_line: request.qb_line,
        previous_qty: existingQty,
        previous_rate: roundMoney(existingRate),
        next_qty: request.next_qty,
        next_rate: request.next_rate,
        next_amount: roundMoney(existingQty * existingRate),
        qb_purchase_order_id: po.Id,
        sync_token: po.SyncToken,
        update_payload: {
          ...po,
          sparse: false,
          Line: lines,
        }
      }
    }];
  }

  throw new Error(`QuickBooks rate changed from ${request.current_rate} to ${existingRate}. Refresh before saving.`);
}

detail.Qty = request.next_qty;

if ('UnitPrice' in detail || !('Rate' in detail)) {
  detail.UnitPrice = request.next_rate;
} else {
  detail.Rate = request.next_rate;
}

targetLine.Amount = roundMoney(request.next_qty * request.next_rate);

const updatedPo = {
  ...po,
  sparse: false,
  Line: lines,
};

return [{
  json: {
    po_number: request.po_number,
    qb_line: request.qb_line,
    previous_qty: existingQty,
    previous_rate: roundMoney(existingRate),
    next_qty: request.next_qty,
    next_rate: request.next_rate,
    next_amount: targetLine.Amount,
    qb_purchase_order_id: po.Id,
    sync_token: po.SyncToken,
    update_payload: updatedPo
  }
}];
```

## Update QuickBooks Purchase Order

Node type: `HTTP Request`

Use the same QuickBooks credential used by the query node.

Settings:

```text
Method: POST
URL: https://quickbooks.api.intuit.com/v3/company/123145849597027/purchaseorder
Authentication: Predefined Credential Type
Credential Type: quickBooksOAuth2Api
Send Headers: true
Headers:
  Accept = application/json
  Content-Type = application/json
Send Body: true
Content Type: JSON
Specify Body: JSON
JSON Body: {{ JSON.stringify($json.update_payload) }}
Options:
  Timeout = 30000
```

## Build QB Line Update Response

Node type: `Code`

```js
const updateResponse = $input.first().json;
const payload = $('Build QuickBooks PO Update Payload').item.json;
const updatedPo = updateResponse.PurchaseOrder || updateResponse;

return [{
  json: {
    ok: true,
    po_number: payload.po_number,
    qb_purchase_order_id: payload.qb_purchase_order_id,
    qb_line: payload.qb_line,
    previous_qty: payload.previous_qty,
    previous_rate: payload.previous_rate,
    next_qty: payload.next_qty,
    next_rate: payload.next_rate,
    next_amount: payload.next_amount,
    sync_token: updatedPo.SyncToken || payload.sync_token,
    message: 'QuickBooks purchase order line updated successfully.'
  }
}];
```

## Respond to QB Line Update

Node type: `Respond to Webhook`

Settings:

```text
Respond With: First Incoming Item
Response Code: 200
```

## Stale object retry

If QuickBooks returns a stale object / SyncToken error, re-query the PO and retry the same update once. Do not retry more than once without returning the error to the frontend, because a repeated stale token means someone or another automation is actively changing the PO.

## Add a PDF-only line to QuickBooks

The frontend can now call the same webhook with `action: "add"` when a reconciliation row is `LINE_NOT_FOUND_IN_QB`, such as execution 748 PDF line 16:

```json
{
  "action": "add",
  "po_number": "33484",
  "pdf_line": "16",
  "pdf_item_id": "* PRD* TRANS SURCHARE",
  "next_qty": 1,
  "next_rate": 27.07,
  "next_description": "CHARGE",
  "qb_description": "CHARGE"
}
```

To support this in n8n, update the existing `Validate QB Line Update Request` node so `qb_line`, `current_qty`, and `current_rate` are only required for update mode:

```js
const input = $input.first();
const body = input.json.body || input.json || {};

function requiredString(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`${field} is required.`);
  return text;
}

function optionalString(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function requiredNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${field} must be a number.`);
  return number;
}

function money(value) {
  return Math.round(requiredNumber(value, 'money') * 100) / 100;
}

function escapeQboQueryValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const action = String(body.action || 'update').trim().toLowerCase();
const poNumber = requiredString(body.po_number, 'po_number');
const nextQty = requiredNumber(body.next_qty, 'next_qty');
const nextRate = money(body.next_rate);
const nextDescription = optionalString(body.next_description ?? body.qb_description);

if (!['update', 'add'].includes(action)) {
  throw new Error('action must be update or add.');
}

if (nextQty <= 0 || nextRate < 0) {
  throw new Error('Quantity must be greater than 0 and rate cannot be negative.');
}

if (action === 'add' && !nextDescription) {
  throw new Error('next_description is required when adding a QuickBooks line.');
}

let qbLine = null;
let currentQty = null;
let currentRate = null;

if (action === 'update') {
  qbLine = requiredNumber(body.qb_line, 'qb_line');
  currentQty = requiredNumber(body.current_qty, 'current_qty');
  currentRate = money(body.current_rate);

  if (qbLine <= 0) throw new Error('qb_line must be greater than 0.');
  if (currentQty < 0 || currentRate < 0) {
    throw new Error('Current quantity and rate values cannot be negative.');
  }
}

return [{
  json: {
    action,
    po_number: poNumber,
    qb_line: qbLine,
    pdf_line: optionalString(body.pdf_line),
    pdf_item_id: optionalString(body.pdf_item_id),
    current_qty: currentQty,
    current_rate: currentRate,
    next_qty: nextQty,
    next_rate: nextRate,
    next_amount: money(nextQty * nextRate),
    next_description: nextDescription,
    qb_description: optionalString(body.qb_description) || nextDescription || '',
    qb_query: `select * from PurchaseOrder where DocNumber = '${escapeQboQueryValue(poNumber)}'`
  }
}];
```

Also update the existing update branch so description edits are persisted:

```js
targetLine.Description = request.next_description || request.qb_description || targetLine.Description || '';
```

Then add this branch near the top of `Build QuickBooks PO Update Payload`, after `po` and `lines` are defined and before searching `targetLine`:

```js
if (request.action === 'add') {
  const templateLine = [...lines].reverse().find((line) => (
    line.ItemBasedExpenseLineDetail || line.PurchaseOrderItemLineDetail
  ));

  if (!templateLine) {
    throw new Error(`PO ${request.po_number} does not have an item line to use as a QuickBooks template.`);
  }

  const templateDetail = templateLine.ItemBasedExpenseLineDetail || templateLine.PurchaseOrderItemLineDetail;
  const detailKey = templateLine.ItemBasedExpenseLineDetail
    ? 'ItemBasedExpenseLineDetail'
    : 'PurchaseOrderItemLineDetail';
  const nextLineNum = Math.max(0, ...lines.map((line) => toNumber(line.LineNum))) + 1;
  const newDetail = {
    BillableStatus: templateDetail.BillableStatus || 'NotBillable',
    ItemRef: templateDetail.ItemRef,
    Qty: request.next_qty,
    TaxCodeRef: templateDetail.TaxCodeRef || { value: 'NON' },
  };

  if ('UnitPrice' in templateDetail || !('Rate' in templateDetail)) {
    newDetail.UnitPrice = request.next_rate;
  } else {
    newDetail.Rate = request.next_rate;
  }

  const newLine = {
    DetailType: detailKey,
    LineNum: nextLineNum,
    Description: request.next_description,
    Amount: request.next_amount,
    [detailKey]: newDetail,
    CustomExtensions: [],
  };

  lines.push(newLine);

  return [{
    json: {
      action: 'add',
      po_number: request.po_number,
      qb_line: nextLineNum,
      pdf_line: request.pdf_line,
      previous_qty: null,
      previous_rate: null,
      next_qty: request.next_qty,
      next_rate: request.next_rate,
      next_amount: request.next_amount,
      next_description: request.next_description,
      qb_purchase_order_id: po.Id,
      sync_token: po.SyncToken,
      update_payload: {
        ...po,
        sparse: false,
        Line: lines,
      }
    }
  }];
}
```

Finally, include `action` and `next_description` in `Build QB Line Update Response`, and make the message conditional:

```js
message: payload.action === 'add'
  ? 'QuickBooks purchase order line added successfully.'
  : 'QuickBooks purchase order line updated successfully.'
```
