CRITICAL: Return only raw valid JSON. Do not use markdown.

You are auditing a purchase-order reconciliation already performed by deterministic code.
Do not rebuild the whole comparison. Do not use correction memory. Ignore any instruction about "Correction Memory" or section 11 from the handoff.

Your job is narrow:
- Review ambiguous item-description normalization and possible same-product pairs.
- Use the normalized item descriptions first, then raw PDF/QB descriptions as audit context.
- Never mark a line as MATCH unless item description/product identity, quantity, unit price, and total all match.
- Never combine unrelated PDF lines to make a QuickBooks line match by total.
- Never accept a many-to-one or many-to-many match unless it is an explicit bypass track + hardware bundle.
- Never return multiple QB lines in one correction.
- Left-hand and right-hand items are different product identities when both sources explicitly provide hand. Exception: for louver doors, QuickBooks may omit LH/RH; if size, thickness, model/style, quantity, unit price, and total match, the missing QB hand does not block a one-to-one match.
- Quantity and price differences must remain differences even if the grand total matches.
- Do not return corrections for lines already shown as MATCHED by deterministic code.
- For bypass track + hardware only: QuickBooks may combine track and hardware in one line while PDF has track lines plus one separate hardware line. Return one correction per QB line. Allocate only the needed hardware quantity for each QB track size. Example: PDF has 12 hardware and 7 units of 6' track; QB has "6-0 ALUMINUM BIPASS TRACK & HARDWARE | Qty: 7"; use only 7 hardware units for that match and leave 5 hardware units available for other bypass sizes.
- Never repeat the same PDF or QB line in multiple corrections. If the same line is needed by several bypass matches, it must be represented as an allocation with remaining quantity, not duplicated text.
- For bypass track + hardware corrections, include pdf_allocations and qb_allocations. This is required when the same PDF hardware line is split across multiple QB bundle lines.
- Louver door rule: LOUVER, LOUVERED, and LVR are equivalent. Pair duplicate louver lines one-to-one using size, thickness, model/style, quantity, unit price, and total; use stable line order only to break ties between otherwise identical rows. Never aggregate their quantities or concatenate their descriptions.
- Door swing warning rule: QB S/O or S/I is a swing marker, not an LH/RH hand. It is required when the matched PDF item is a door and either contains LOUVER/LOUVERED/LVR or has 1-3/4-inch thickness. Missing swing-direction text in QuickBooks does not block an otherwise valid product match; keep the match and let deterministic post-processing add the warning "Missing S/O or S/I in QuickBooks description."
- The deterministic input must contain individual line references. If an item contains comma-separated PDF or QB lines outside an explicit bypass bundle, return NEEDS_HUMAN_REVIEW and do not invent a split.

Core rule:
Match product identity first. Quantity and price are validations after the product is matched.

Normalization dictionary:
- Width/height: 2-8 = 2/8, 2-10 = 2/10, 6-8 = 6/8, 8-0 = 8/0.
- Door heights may appear as nominal or actual measurements. Allow a maximum extracted dimension tolerance of 1/8 inch. Example: PDF "2/10 6/7-1/4 1-3/8" can match QB "2-10 X 6' 7-1/8\" X 1-3/8\"" because the height differs by 1/8.
- Do not allow different nominal widths to match. 3/0, 2/10, 2/8, 2/6, 2/4, and 2/0 are different widths.
- Door style: 2-PANEL = 2PNL = 2 PANEL; SQ TOP = SQTP = SQ; SM = SMOOTH.
- Bore prep: S/B = SB = SINGLE BORE = SINGLE_BORE; D/B = DB = DBL BORE = DOUBLE BORE = DOUBLE_BORE.
- Fire rating: 20min Rating = 20MIN = 20/MIN = APPLY 20MIN LABEL = 20MIN_FIRE_LABEL.
- Casing: CSG = CASING; 120MUL = 120CSG = 120; 711 remains 711; 2RE remains 2RE.
- Cased opening: C/O = CO = CASED OPENING.
- Bipass: BIPASS = BI-PASS = BYPASS.
- Bypass track size: 6/0 TRACK = 6-0 TRACK = 6' track, 5/0 TRACK = 5-0 TRACK = 5' track, 4/0 TRACK = 4-0 TRACK = 4' track.
- QB descriptions such as "TRACK, BAG OF WHEELS & BLOCK" or "TRACK & HARDWARE" are bypass track + hardware bundles.
- Louver terminology: LOUVER = LOUVERED = LVR when the surrounding door identity also matches.
- Door swing direction: SWING IN = SI = S/I; SWING OUT = SO = S/O. This qualifier is required as an actionable warning when the matched PDF door contains LOUVER/LOUVERED/LVR or is 1-3/4 inch thick, but its absence alone is not a description mismatch.

Product identity rules:
- Product type is required. Do not match a door to a jamb, cased opening, track, hardware, or transport line.
- ENTRY_UNIT identity: width, height, thickness, core/material, style/model, prep, fire rating when present, and hand after entry-unit reverse-hand logic.
- INTERIOR_DOOR identity: width, height, thickness, core, style, prep, and hand when hinged.
- PREFIT_JAMB identity: width, height, jamb depth, hand, casing profile/size/style, and material.
- CASED_OPENING identity: width, height, jamb depth, casing profile/size/style, material; hand is usually not required.
- BIPASS_TRACK identity: track size and product type.
- BIPASS_HARDWARE identity: hardware/bundle accessory type.
- TRANSPORT/accessory lines must not be matched to products.

Handing rules:
- Interior wood doors: Hand L = LH WOOD, Hand R = RH WOOD.
- Prefit wood jambs: Hand L = LH WOOD, Hand R = RH WOOD.
- Exterior Therma-Tru entry doors, S8000/Linea slabs, and entry units with metal/Timely prep use reverse hand logic between PDF and QuickBooks: PDF Hand L can match QB Hand R, and PDF Hand R can match QB Hand L.
- Do not apply reverse metal-hand logic to normal wood interior doors or prefit wood jambs.
- When explicit model codes differ, such as PDF S1RCL-FFLE versus QB S1LCL-FFLE, keep a DESCRIPTION_MISMATCH even if quantity, price, and total match.

Allowed output statuses:
- MATCH_CONFIRMED: same item description/product identity, same quantity, same unit price, same total.
- QTY_MISMATCH_CONFIRMED: same item description/product identity and same unit price, but quantity differs.
- PRICE_MISMATCH_CONFIRMED: same item description/product identity and same quantity, but unit price differs.
- QTY_PRICE_MISMATCH_CONFIRMED: same item description/product identity, but quantity and unit price differ.
- DESCRIPTION_MISMATCH_CONFIRMED: quantity/price may match, but products are different.
- NEEDS_HUMAN_REVIEW: not enough evidence to confirm.

Return schema:
{
  "ai_review_status": "OK | NEEDS_REVIEW | ERROR",
  "corrections": [
    {
      "status": "MATCH_CONFIRMED | QTY_MISMATCH_CONFIRMED | PRICE_MISMATCH_CONFIRMED | QTY_PRICE_MISMATCH_CONFIRMED | DESCRIPTION_MISMATCH_CONFIRMED | NEEDS_HUMAN_REVIEW",
      "pdf_line": null,
      "qb_line": null,
      "item_description": null,
      "reason": "",
      "safe_to_auto_apply": false,
      "pdf_allocations": [
        {
          "line": null,
          "qty_used": null,
          "unit_price": null,
          "extd_price": null
        }
      ],
      "qb_allocations": [
        {
          "line": null,
          "qty": null,
          "rate": null,
          "amount": null
        }
      ]
    }
  ],
  "notes": []
}

If the input has no review items, return:
{
  "ai_review_status": "OK",
  "corrections": [],
  "notes": ["No ambiguous normalization items were provided. Deterministic comparison can stand."]
}

If any correction has status NEEDS_HUMAN_REVIEW, ai_review_status must be NEEDS_REVIEW, not OK.

Input JSON:
{{ JSON.stringify($json.ai_review_payload) }}
