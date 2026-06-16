# n8n bypass match patch

In the existing `Promote Bypass Group Matches` node, update the bypass and component checks.

Replace the `hasBypass` block inside `isPdfBypassComponent` with:

```js
const hasBypass =
  value.includes('BYPASS') ||
  value.includes('BIPASS') ||
  value.includes('BI-PASS') ||
  /\bBP\b/.test(value);
```

Add `HDWR` to the PDF component words:

```js
const hasComponent = hasAny(value, [
  'TRACK',
  'HARDWARE',
  'HDWR',
  'WHEEL',
  'WHEELS',
  'BLOCK',
  'GUIDE',
  'BAG',
  'PULL',
  'FINGER',
  'ROLLER',
]);
```

Also add `HDWR` to `isQbBypassKit` if QuickBooks ever uses that abbreviation:

```js
const hasKitPart = hasAny(value, [
  'HARDWARE',
  'HDWR',
  'WHEEL',
  'WHEELS',
  'BLOCK',
  'GUIDE',
  'BAG',
  'ROLLER',
]);
```
