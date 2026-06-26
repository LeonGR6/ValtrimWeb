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
