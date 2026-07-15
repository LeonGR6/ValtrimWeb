const item = $input.first();
const input = item.json || {};
const binary = item.binary || {};

const pdfData = input.pdfData || {};
const qbData = input.qbData || {};

const MONEY_TOL = 0.05;
const QTY_TOL = 0.0001;
const DIMENSION_TOL_INCHES = 0.125;

function toNumber(value) {
  const n = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value) {
  return Math.round(toNumber(value) * 100) / 100;
}

function moneyMatch(a, b, tolerance = MONEY_TOL) {
  return Math.abs(toNumber(a) - toNumber(b)) <= tolerance;
}

function qtyMatch(a, b) {
  return Math.abs(toNumber(a) - toNumber(b)) <= QTY_TOL;
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== '';
}

function cleanText(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanOcrDescription(value) {
  return String(value || '')
    .replace(
      /(\*{3}\s*BEVEL\s+2\s+SIDES\s*\*{3})(?:\s*\*{3}\s*BEVEL\s+2\s+SIDES\s*\*{3})+/gi,
      '$1'
    )
    .replace(/\s+/g, ' ')
    .trim();
}

function joinValues(values, separator = ', ') {
  const visible = values.filter(hasValue);
  return visible.length ? visible.join(separator) : null;
}

function uniqueNumbers(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const n = roundMoney(value);
    const key = String(n);

    if (!seen.has(key)) {
      seen.add(key);
      result.push(n);
    }
  }

  return result;
}

function parseFraction(value) {
  const match = String(value || '').trim().match(/^(\d+)\/(\d+)$/);

  if (!match) return 0;

  const numerator = Number(match[1]);
  const denominator = Number(match[2]);

  return denominator ? numerator / denominator : 0;
}

function parseInchesPart(value) {
  const text = String(value || '')
    .replace(/"/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return 0;

  let match = text.match(/^(\d+)-(\d+\/\d+)$/);
  if (match) return Number(match[1]) + parseFraction(match[2]);

  match = text.match(/^(\d+)\s+(\d+\/\d+)$/);
  if (match) return Number(match[1]) + parseFraction(match[2]);

  match = text.match(/^(\d+)$/);
  if (match) return Number(match[1]);

  return toNumber(text);
}

function formatDimensionFromInches(totalInches) {
  if (!Number.isFinite(totalInches) || totalInches <= 0) return null;

  const rounded = Math.round(totalInches * 8) / 8;
  const feet = Math.floor(rounded / 12);
  const inches = rounded - feet * 12;
  const whole = Math.floor(inches);
  const fraction = Math.round((inches - whole) * 8);

  if (fraction === 0) return `${feet}-${whole}`;
  if (fraction === 4) return `${feet}-${whole}-1/2`;
  if (fraction === 2) return `${feet}-${whole}-1/4`;
  if (fraction === 6) return `${feet}-${whole}-3/4`;

  return `${feet}-${whole}-${fraction}/8`;
}

function formatCanonicalDimension(totalInches) {
  const formatted = formatDimensionFromInches(totalInches);

  if (!formatted) return null;

  return formatted.replace(/^(\d+)-(\d+)/, '$1/$2');
}

function dimensionClose(a, b, tolerance = DIMENSION_TOL_INCHES) {
  return (
    Number.isFinite(a) &&
    Number.isFinite(b) &&
    Math.abs(a - b) <= tolerance
  );
}

function normalizeNominalHeight(totalInches) {
  if (!Number.isFinite(totalInches) || totalInches <= 0) return null;

  if (totalInches >= 79 && totalInches <= 80.25) return '6-8';
  if (totalInches >= 95 && totalInches <= 96.25) return '8-0';

  return formatDimensionFromInches(totalInches);
}

function extractPrimarySize(description) {
  const value = cleanText(description)
    .replace(/(\d)\s*'\s*/g, '$1-')
    .replace(/"/g, '');

  let match = value.match(
    /\b([1-9])\s*[/-]\s*(\d{1,2}(?:-\d+\/\d+)?)\s*X\s*([1-9])\s*[/-]\s*(\d{1,2}(?:-\d+\/\d+)?(?:\s+\d+\/\d+)?)\b/
  );

  if (!match) {
    match = value.match(
      /\b([1-9])\s*[/-]\s*(\d{1,2}(?:-\d+\/\d+)?)\s+([1-9])\s*[/-]\s*(\d{1,2}(?:-\d+\/\d+)?(?:\s+\d+\/\d+)?)\b/
    );
  }

  if (!match) {
    return {
      width: null,
      widthCanonical: null,
      widthInches: null,
      height: null,
      heightCanonical: null,
      heightInches: null,
    };
  }

  const widthFeet = Number(match[1]);
  const widthInchesPart = parseInchesPart(match[2]);
  const heightFeet = Number(match[3]);
  const heightInchesPart = parseInchesPart(match[4]);
  const widthInches = widthFeet * 12 + widthInchesPart;
  const heightInches = heightFeet * 12 + heightInchesPart;

  return {
    width: formatDimensionFromInches(widthInches),
    widthCanonical: formatCanonicalDimension(widthInches),
    widthInches,
    height: normalizeNominalHeight(heightInches),
    heightCanonical: normalizeNominalHeight(heightInches)?.replace(/^(\d+)-(\d+)/, '$1/$2') ?? null,
    heightInches,
  };
}

function extractTrackSize(description) {
  const rawValue = cleanText(description);
  const value = rawValue
    .replace(/(\d)\s*'\s*/g, '$1-')
    .replace(/"/g, '');

  let match = value.match(/\b([2-9])\/0\s+(?:ALUMINUM\s+)?(?:(?:BYPASS|BIPASS|BI-PASS)\s+)?TRACK\b/);
  if (match) return `${match[1]}-0`;

  match = value.match(/\b([2-9])\/0\s+TRACK\b/);
  if (match) return `${match[1]}-0`;

  match = value.match(/\b([2-9])-0\s+(?:ALUMINUM\s+)?(?:BYPASS|BIPASS|BI-PASS)\s+TRACK\b/);
  if (match) return `${match[1]}-0`;

  match = value.match(/\b([2-9])-0\s+TRACK\b/);
  if (match) return `${match[1]}-0`;

  match = rawValue.match(/\b([2-9])\s*'\s+(?:ALUMINUM\s+)?(?:BYPASS|BIPASS|BI-PASS)\s+TRACK\b/);
  if (match) return `${match[1]}-0`;

  match = value.match(/\b([2-9])-(?:ALUMINUM\s+)?(?:BYPASS|BIPASS|BI-PASS)\s+TRACK\b/);
  if (match) return `${match[1]}-0`;

  match = rawValue.match(/\b63050-0([2-9])\b/);
  if (match) return `${match[1]}-0`;

  match = value.match(/\b4530\s+([2-9])\s*'\b/);
  if (match) return `${match[1]}-0`;

  return null;
}

function extractJambDepth(description) {
  const value = cleanText(description).replace(/"/g, '');

  if (/\b4\s*-\s*9\/16\b/.test(value)) return '4-9/16';
  if (/\b5\s*-\s*1\/4\b/.test(value)) return '5-1/4';

  return null;
}

function extractThickness(description) {
  const value = cleanText(description).replace(/"/g, '');

  if (/\b1(?:\s*-\s*|\s+)3\/8\b/.test(value)) return '1-3/8';
  if (/\b1(?:\s*-\s*|\s+)3\/4\b/.test(value)) return '1-3/4';

  return null;
}

function extractCore(description) {
  const value = cleanText(description);

  if (/\bHC\b/.test(value)) return 'HC';
  if (/\bSC\b/.test(value)) return 'SC';
  if (/\bFIBERGLASS\b|\bFIBER\s*GLASS\b|\bFG\b/.test(value)) return 'FIBERGLASS';

  return null;
}

function extractMaterial(description) {
  const value = cleanText(description);

  if (/\bMDF\b/.test(value)) return 'MDF';
  if (/\bFIBERGLASS\b|\bFIBER\s*GLASS\b|\bFG\b/.test(value)) return 'FIBERGLASS';
  if (/\bWOOD\b/.test(value)) return 'WOOD';
  if (/\bSTEEL\b|\bMETAL\b/.test(value)) return 'METAL';

  return null;
}

function extractStyle(description) {
  const value = cleanText(description);
  const style = [];

  if (/\b(?:2PNL|2-PANEL|2 PANEL)\b/.test(value)) style.push('2PANEL');
  if (/\bLOUVER(?:ED)?\b|\bLVR\b/.test(value)) style.push('LOUVER');
  if (/\b(?:SQTP|SQ\s*TOP|SQ)\b/.test(value)) style.push('SQ');

  return style.length ? style.join('-') : null;
}

function extractCasing(description) {
  const casing = [];
  const profile = extractCasingProfile(description);
  const size = extractCasingSize(description);
  const style = extractCasingStyle(description);

  if (profile) casing.push(profile);
  if (size) casing.push(size);
  if (style) casing.push(style);

  return casing.length ? casing.join('-') : null;
}

function extractFireRating(description) {
  const value = cleanText(description);

  if (/\b20\s*\/?\s*MIN\b|\b20MIN\b/.test(value)) return '20MIN_FIRE_LABEL';

  return null;
}

function extractPrep(description) {
  const value = cleanText(description);
  const prep = [];

  if (/(^|[^A-Z0-9])D\/B([^A-Z0-9]|$)|\bDB\b|\bDBL\s+BORE\b|\bDOUBLE\s+BORE\b/.test(value)) {
    prep.push('DOUBLE_BORE');
  }

  if (/(^|[^A-Z0-9])S\/B([^A-Z0-9]|$)|\bSB\b|\bSINGLE\s+BORE\b/.test(value)) {
    prep.push('SINGLE_BORE');
  }

  if (/\b(?:BYPASS|BIPASS|BI-PASS)\s+DOOR\s+PREP\b/.test(value)) {
    prep.push('BIPASS_PREP');
  }

  if (/\bTOP\s+HANG\b|\bNO\s+HINGE\s+PREP\b|\bSQ\s+EDGE\s+DOOR\b/.test(value)) {
    prep.push('NO_HINGE_PREP');
  }

  return prep.length ? prep.join('+') : null;
}

function prepForIdentity(category, prep) {
  if (category === 'ENTRY_UNIT') {
    return prep || 'UNKNOWN';
  }

  if (category === 'INTERIOR_DOOR') {
    if (String(prep || '').includes('DOUBLE_BORE')) return 'DOUBLE_BORE';
    if (String(prep || '').includes('NO_HINGE_PREP')) return 'NO_HINGE_PREP';

    return 'STANDARD_PREP';
  }

  return prep || 'NO_PREP';
}

function extractHingeCount(description) {
  const value = cleanText(description);
  const match = value.match(/\b(\d+)\s+(?:US3-4\s+)?HINGES?\b/);

  return match ? Number(match[1]) : null;
}

function extractSpecialPrep(description) {
  const value = cleanText(description);
  const special = [];

  if (/\bTIMELY\s+HINGE\s+PREP\b|\bTIMELY\b/.test(value)) special.push('TIMELY_PREP');
  if (/\b5\s*-\s*1\/2\s*(?:\"|INCH|INCHES)?\s*O\.?C\.?\b/.test(value)) special.push('5-1/2_OC');
  if (/\bSI\b/.test(value)) special.push('SI');
  if (/\b(?:10\s*(?:\"|INCH|INCHES)?\s+BOTTOM\s+RAIL|COMMERCIAL\s+10\s*(?:\"|INCH|INCHES)?\s+BOTTOM\s+RAIL|ADA\s+BOTTOM\s+RAIL)\b/.test(value)) {
    special.push('10IN_BOTTOM_RAIL');
  }
  if (/\bPIN\s+NAIL\s+STOP\b/.test(value)) special.push('PIN_NAIL_STOP');

  return special;
}

function extractCasingProfile(description) {
  const value = cleanText(description);

  if (/\b711\b/.test(value)) return '711';

  const profileMatch = value.match(/\b(10[78]|120)(?:MUL|CSG)?\b/);
  if (profileMatch) return profileMatch[1];

  return null;
}

function extractCasingSize(description) {
  const value = cleanText(description).replace(/"/g, '');

  if (/\b1\s*-\s*5\/8\b/.test(value)) return '1-5/8';
  if (/\b2\s*-\s*1\/4\b/.test(value)) return '2-1/4';

  return null;
}

function extractCasingStyle(description) {
  const value = cleanText(description);

  if (/\b2RE\b/.test(value)) return '2RE';

  return null;
}

function extractHand(description) {
  const value = cleanText(description);
  const explicit = value.match(/\bHAND\s*:\s*([LR])\b/);

  if (explicit) return explicit[1];
  if (/\bLH\b|\bLEFT\s+HAND\b/.test(value)) return 'L';
  if (/\bRH\b|\bRIGHT\s+HAND\b/.test(value)) return 'R';

  return null;
}

function isLouverDescription(description) {
  const value = cleanText(description);

  return /\bLOUVER(?:ED)?\b|\bLVR\b|\bLVR\s*\/\s*LVR\b/.test(value);
}

function isThermaTruEntryDescription(description) {
  const value = cleanText(description);

  return (
    /\bTHERMA[\s-]*TRU\b/.test(value) ||
    /\bSMOOTH[\s-]*STAR\b/.test(value) ||
    /\bS8000[\s-]*LE\b/.test(value)
  );
}

function extractDoorModel(description) {
  const value = cleanText(description);
  const s1Model = value.match(/\bS1([LR])CL\s*-?\s*FFLE\b/);

  if (s1Model) return `S1${s1Model[1]}CL-FFLE`;
  if (/\bS8000\s*-?\s*LE\b/.test(value)) return 'S8000LE';
  if (isLouverDescription(value) && /(?:#\s*|\b)730\b/.test(value)) return '730';

  return null;
}

function hasMetalHanding(description) {
  const value = cleanText(description);

  return /\bMETAL\s+HANDING\b|\bSTEEL\s+HANDING\b|\bRH\s+METAL\b|\bLH\s+METAL\b|\bRH\s+STEEL\b|\bLH\s+STEEL\b/.test(value);
}

function usesReverseEntryHand(description) {
  const value = cleanText(description);

  return (
    hasMetalHanding(value) ||
    /\bTIMELY\b/.test(value) ||
    isThermaTruEntryDescription(value)
  );
}

function normalizePdfHand(description, productType) {
  const hand = extractHand(description);

  if (!hand) return null;

  if (productType === 'ENTRY_UNIT' && usesReverseEntryHand(description)) {
    return hand === 'R' ? 'L' : 'R';
  }

  return hand;
}

function detectCategory(description) {
  const value = cleanText(description);
  const hasBypass = /\b(?:BYPASS|BIPASS|BI-PASS|BP)\b/.test(value);
  const hasTrack = /\bTRACK\b/.test(value);
  const hasHardware = /\b(?:HARDWARE|HDWR|WHEEL|WHEELS|BLOCK|GUIDE|BAG|ROLLER|FINGER\s+PULL|NO\s+FINGER\s+PULL)\b/.test(value);

  if (/\b(?:TRANS|TRANSPORT|TRANSPORTATION|FREIGHT|SHIPPING|HINGE\s+PINS?)\b/.test(value)) return 'TRANSPORT';
  if (hasBypass && hasTrack && !hasHardware) return 'BYPASS_TRACK';
  if (hasTrack && hasHardware) return 'BYPASS_BUNDLE';
  if (hasBypass && hasHardware) return 'BYPASS_HARDWARE';
  if (/\bCASED\s+OPENING\b|\bC\/O\b|\bC\s*O\s+JAMB\b/.test(value)) return 'CASED_OPENING';
  if (/\bPREFIT\s+JAMB\b|\bJAMB\s+SET\b|\bFB\s+PREFIT\s+JAMB\b|\bMDF\s+CASING\b/.test(value)) return 'PREFIT_JAMB';
  if (
    isLouverDescription(value) &&
    /\bDOOR\b|\bSLAB\b|\bMDF\b|\bPRIMED\b|(?:#\s*|\b)730\b|\b2[\s-]*PANEL\b|\bB2\b/.test(value)
  ) return 'INTERIOR_DOOR';
  if (
    /\bENTRY\s+UNIT\b|\b20\s*\/?\s*MIN\b|\b20MIN\b/.test(value) ||
    isThermaTruEntryDescription(value) ||
    (
      /\b1\s*-\s*3\/4\b/.test(value) &&
      /\b(?:SC|FIBERGLASS|FIBER\s*GLASS|PLASTPRO|LOW\s*-?\s*E|1\s*-?\s*LITE|1LT)\b/.test(value)
    )
  ) return 'ENTRY_UNIT';
  if (/\bINTERIOR(?:\s+WOOD)?\s+DOOR\b|\bDOOR\s+ENTRY\b|\bCARRARA\b|\bHC\b|\b2PNL\b|\b2[\s-]PANEL\b/.test(value)) return 'INTERIOR_DOOR';

  return 'OTHER';
}

function fallbackSignature(description) {
  return cleanText(description)
    .replace(/\|\s*QTY\s*:\s*\d+(?:\.\d+)?/g, '')
    .replace(/\bQTY\s*:\s*\d+(?:\.\d+)?/g, '')
    .replace(/\bVENDOR\s+PROD\s*:\s*\S+/g, '')
    .replace(/[^A-Z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token.length >= 2 && !/^\d+$/.test(token))
    .slice(0, 12)
    .join('-');
}

function compactParts(parts) {
  return parts.filter(hasValue).join(' ');
}

function dimensionText(size, key) {
  return size?.[`${key}Canonical`] || size?.[key] || null;
}

function buildItemDescription(fields) {
  const base = [
    fields.category,
    fields.size?.widthCanonical || fields.size?.width,
    fields.size?.heightCanonical || fields.size?.height,
  ];

  if (fields.category === 'ENTRY_UNIT' || fields.category === 'INTERIOR_DOOR') {
    base.push(
      fields.thickness,
      fields.core,
      fields.isLouver ? 'LOUVER' : fields.style,
      fields.doorModel,
      fields.prep,
      fields.fireRating,
      !fields.isLouver && fields.hand ? `HAND_${fields.hand}` : null
    );
  } else if (fields.category === 'PREFIT_JAMB') {
    base.push(
      fields.jambDepth,
      fields.material,
      fields.casing,
      fields.hand ? `HAND_${fields.hand}` : null
    );
  } else if (fields.category === 'CASED_OPENING') {
    base.push(
      fields.jambDepth,
      fields.material,
      fields.casing,
      'CASED_OPENING'
    );
  } else if (fields.category === 'BYPASS_TRACK') {
    base.splice(1, 2, fields.trackSize);
  } else if (fields.category === 'BYPASS_BUNDLE') {
    base.splice(1, 2, fields.trackSize, 'TRACK_HARDWARE_BUNDLE');
  } else if (fields.category === 'BYPASS_HARDWARE') {
    base.splice(1, 2, 'TRACK_HARDWARE');
  }

  if (fields.hingeCount) base.push(`${fields.hingeCount}_HINGES`);
  if (Array.isArray(fields.specialPrep)) base.push(...fields.specialPrep);

  return compactParts(base);
}

function normalizeProduct(line, side) {
  const description = side === 'pdf'
    ? line.description ?? line.pdf_description
    : line.qb_description ?? line.description;
  const category = detectCategory(description);
  const size = extractPrimarySize(description);
  const isLouver = isLouverDescription(description);
  const doorModel = extractDoorModel(description);
  const hand = side === 'pdf'
    ? normalizePdfHand(description, category)
    : extractHand(description);
  const trackSize = extractTrackSize(description);
  const jambDepth = extractJambDepth(description);
  const thickness = extractThickness(description) || (
    category === 'ENTRY_UNIT' && isThermaTruEntryDescription(description)
      ? '1-3/4'
      : null
  );
  const core = extractCore(description);
  const material = extractMaterial(description);
  const style = extractStyle(description);
  const casing = extractCasing(description);
  const casingProfile = extractCasingProfile(description);
  const casingSize = extractCasingSize(description);
  const casingStyle = extractCasingStyle(description);
  const fireRating = extractFireRating(description);
  const prep = extractPrep(description);
  const identityPrep = prepForIdentity(category, prep);
  const hingeCount = extractHingeCount(description);
  const specialPrep = extractSpecialPrep(description);

  let productKey;
  let productLabel;
  const normalizedFields = {
    category,
    isLouver,
    doorModel,
    size,
    hand,
    trackSize,
    jambDepth,
    thickness,
    core,
    material,
    style,
    casing,
    casingProfile,
    casingSize,
    casingStyle,
    fireRating,
    prep,
    identityPrep,
    hingeCount,
    specialPrep,
  };
  const itemDescription = buildItemDescription(normalizedFields);

  if (category === 'BYPASS_TRACK') {
    productKey = `BYPASS_TRACK|size=${trackSize || 'UNKNOWN'}`;
    productLabel = itemDescription || `${trackSize || 'Unknown'} bypass track`;
  } else if (category === 'BYPASS_HARDWARE') {
    productKey = `BYPASS_HARDWARE|kit=TRACK_HARDWARE`;
    productLabel = itemDescription || 'Bypass hardware kit';
  } else if (category === 'BYPASS_BUNDLE') {
    productKey = `BYPASS_BUNDLE|size=${trackSize || 'UNKNOWN'}`;
    productLabel = itemDescription || `${trackSize || 'Unknown'} track + hardware bundle`;
  } else if (category === 'PREFIT_JAMB') {
    productKey = [
      'PREFIT_JAMB',
      `w=${size.width || 'UNKNOWN'}`,
      `h=${size.height || 'UNKNOWN'}`,
      `depth=${jambDepth || 'UNKNOWN'}`,
      `casing=${casing || 'UNKNOWN'}`,
      `hand=${hand || 'NO_HAND'}`,
    ].join('|');
    productLabel = itemDescription || `${size.width || '?'} x ${size.height || '?'} ${jambDepth || '?'} ${casing || ''} jamb ${hand || ''}`.trim();
  } else if (category === 'CASED_OPENING') {
    productKey = [
      'CASED_OPENING',
      `w=${size.width || 'UNKNOWN'}`,
      `h=${size.height || 'UNKNOWN'}`,
      `depth=${jambDepth || 'UNKNOWN'}`,
      `casing=${casing || 'UNKNOWN'}`,
    ].join('|');
    productLabel = itemDescription || `${size.width || '?'} x ${size.height || '?'} ${jambDepth || '?'} ${casing || ''} cased opening`.trim();
  } else if (category === 'INTERIOR_DOOR' && isLouver) {
    productKey = [
      'INTERIOR_DOOR_LOUVER',
      `w=${size.width || 'UNKNOWN'}`,
      `h=${size.height || 'UNKNOWN'}`,
      `thick=${thickness || 'UNKNOWN'}`,
      `model=${doorModel || 'LOUVER'}`,
    ].join('|');
    productLabel = itemDescription || `${size.width || '?'} x ${size.height || '?'} ${thickness || ''} louver door`.trim();
  } else if (category === 'ENTRY_UNIT' || category === 'INTERIOR_DOOR') {
    productKey = [
      category,
      `w=${size.width || 'UNKNOWN'}`,
      `h=${size.height || 'UNKNOWN'}`,
      `thick=${thickness || 'UNKNOWN'}`,
      `core=${core || 'UNKNOWN'}`,
      `style=${style || 'UNKNOWN'}`,
      `prep=${identityPrep || 'UNKNOWN'}`,
      `fire=${fireRating || 'NO_FIRE'}`,
      `hand=${hand || 'NO_HAND'}`,
    ].join('|');
    productLabel = itemDescription || `${size.width || '?'} x ${size.height || '?'} ${thickness || ''} ${core || ''} ${style || ''} door ${hand || ''}`.trim();
  } else if (category === 'TRANSPORT') {
    const signature = fallbackSignature(description);
    productKey = `TRANSPORT|${signature || 'UNKNOWN'}`;
    productLabel = itemDescription || signature || 'Transport/accessory line';
  } else {
    const signature = fallbackSignature(description);
    const handKey = hand ? `hand=${hand}` : 'hand=NO_HAND';
    productKey = [
      'OTHER',
      `w=${size.width || 'UNKNOWN'}`,
      `h=${size.height || 'UNKNOWN'}`,
      `thick=${thickness || 'UNKNOWN'}`,
      `material=${material || 'UNKNOWN'}`,
      `style=${style || 'UNKNOWN'}`,
      `prep=${identityPrep || 'NO_PREP'}`,
      `signature=${signature || 'UNKNOWN'}`,
      handKey,
    ].join('|');
    productLabel = compactParts([
      signature || itemDescription || 'Unclassified product',
      hand ? `HAND_${hand}` : null,
    ]);
  }

  return {
    category,
    productType: category,
    isLouver,
    doorModel,
    productKey,
    productLabel,
    itemDescription: productLabel,
    normalizedDescription: productLabel,
    rawHand: extractHand(description),
    comparisonHand: hand,
    size,
    trackSize,
    jambDepth,
    thickness,
    core,
    material,
    style,
    casing,
    casingProfile,
    casingSize,
    casingStyle,
    fireRating,
    prep,
    identityPrep,
    hingeCount,
    specialPrep,
  };
}

function normalizePdfLine(line) {
  const rawDescription = line.description ?? line.pdf_description ?? '';
  const description = cleanOcrDescription(rawDescription);
  const qty = toNumber(line.ordered ?? line.qty ?? line.pdf_qty);
  const unitPrice = toNumber(line.unit_price ?? line.pdf_unit_price);
  const amount = roundMoney(line.extd_price ?? line.pdf_extd_price ?? qty * unitPrice);
  const normalized = normalizeProduct({ ...line, description }, 'pdf');

  return {
    side: 'pdf',
    line: line.line ?? line.pdf_line ?? null,
    item_id: line.item_id ?? line.pdf_item_id ?? null,
    description,
    source_description: rawDescription,
    item_description: normalized.itemDescription,
    qty,
    unitPrice,
    amount,
    remainingQty: qty,
    normalized,
  };
}

function normalizeQbLine(line) {
  const qty = toNumber(line.qb_qty ?? line.qty);
  const unitPrice = toNumber(line.qb_rate ?? line.rate);
  const amount = roundMoney(line.qb_amount ?? line.amount ?? qty * unitPrice);
  const normalized = normalizeProduct(line, 'qb');

  return {
    side: 'qb',
    line: line.qb_line_num ?? line.qb_line ?? line.line ?? null,
    sku: line.qb_sku ?? line.sku ?? null,
    description: line.qb_description ?? line.description ?? '',
    item_description: normalized.itemDescription,
    qty,
    unitPrice,
    amount,
    used: false,
    normalized,
  };
}

function lineRefs(lines) {
  return joinValues(lines.map((line) => line.line));
}

function descriptions(lines, separator = ' / ') {
  return joinValues(lines.map((line) => line.description), separator);
}

function itemDescriptions(lines, separator = ' / ') {
  return joinValues(lines.map((line) => line.item_description || line.normalized?.itemDescription), separator);
}

function quantities(lines) {
  return joinValues(lines.map((line) => line.qty));
}

function unitPrices(lines) {
  return joinValues(lines.map((line) => line.unitPrice));
}

function amounts(lines) {
  return roundMoney(lines.reduce((sum, line) => sum + toNumber(line.amount), 0));
}

function allocatePdfLine(line, qtyUsed) {
  line.remainingQty = Math.max(0, toNumber(line.remainingQty) - toNumber(qtyUsed));
}

function buildBundleMatch({ qbLine, trackLine, hardwareLine }) {
  const qty = qbLine.qty;
  const trackAmount = roundMoney(qty * trackLine.unitPrice);
  const hardwareAmount = roundMoney(qty * hardwareLine.unitPrice);
  const pdfTotal = roundMoney(trackAmount + hardwareAmount);

  return {
    status: 'MATCHED',
    match_type: 'MANY_PDF_TO_ONE_QB',
    match_rule: 'BYPASS_TRACK_HARDWARE_BUNDLE',
    product_key: qbLine.normalized.productKey,
    product_label: qbLine.normalized.productLabel,
    item_description: qbLine.normalized.itemDescription,
    pdf_line: joinValues([trackLine.line, hardwareLine.line]),
    pdf_item_id: joinValues([trackLine.item_id, hardwareLine.item_id]),
    pdf_item_description: joinValues([trackLine.item_description, hardwareLine.item_description], ' / '),
    pdf_description: joinValues([trackLine.description, hardwareLine.description], ' / '),
    pdf_qty: joinValues([qty, qty]),
    pdf_unit_price: joinValues([trackLine.unitPrice, hardwareLine.unitPrice]),
    pdf_extd_price: pdfTotal,
    qb_line: qbLine.line,
    qb_item_description: qbLine.item_description,
    qb_description: qbLine.description,
    qb_qty: qbLine.qty,
    qb_rate: qbLine.unitPrice,
    qb_amount: qbLine.amount,
    variance: roundMoney(pdfTotal - qbLine.amount),
    match_score: 100,
    match_similarity: 1,
    message: `${qbLine.normalized.productLabel} matched as track/hardware bundle.`,
    pdf_allocations: [
      {
        line: String(trackLine.line),
        item_id: trackLine.item_id,
        item_description: trackLine.item_description,
        description: trackLine.description,
        qty_used: qty,
        unit_price: trackLine.unitPrice,
        extd_price: trackAmount,
        source_qty: trackLine.qty,
      },
      {
        line: String(hardwareLine.line),
        item_id: hardwareLine.item_id,
        item_description: hardwareLine.item_description,
        description: hardwareLine.description,
        qty_used: qty,
        unit_price: hardwareLine.unitPrice,
        extd_price: hardwareAmount,
        source_qty: hardwareLine.qty,
      },
    ],
    qb_allocations: [
      {
        line: String(qbLine.line),
        item_description: qbLine.item_description,
        description: qbLine.description,
        qty: qbLine.qty,
        rate: qbLine.unitPrice,
        amount: qbLine.amount,
      },
    ],
  };
}

function matchBypassBundles(pdfLines, qbLines) {
  const matches = [];
  const bundleLines = qbLines.filter((line) => line.normalized.category === 'BYPASS_BUNDLE');

  for (const qbLine of bundleLines) {
    if (qbLine.used) continue;

    const trackSize = qbLine.normalized.trackSize;
    const trackLine = pdfLines.find((line) => (
      line.normalized.category === 'BYPASS_TRACK' &&
      line.normalized.trackSize === trackSize &&
      toNumber(line.remainingQty) >= qbLine.qty - QTY_TOL
    ));
    const hardwareLine = pdfLines.find((line) => (
      line.normalized.category === 'BYPASS_HARDWARE' &&
      toNumber(line.remainingQty) >= qbLine.qty - QTY_TOL
    ));

    if (!trackLine || !hardwareLine) continue;

    const expectedPdfTotal = roundMoney(qbLine.qty * trackLine.unitPrice + qbLine.qty * hardwareLine.unitPrice);

    if (!moneyMatch(expectedPdfTotal, qbLine.amount)) continue;

    matches.push(buildBundleMatch({ qbLine, trackLine, hardwareLine }));
    allocatePdfLine(trackLine, qbLine.qty);
    allocatePdfLine(hardwareLine, qbLine.qty);
    qbLine.used = true;
  }

  return matches;
}

function residualPdfLines(pdfLines) {
  return pdfLines
    .filter((line) => toNumber(line.remainingQty) > QTY_TOL)
    .map((line) => {
      const qty = toNumber(line.remainingQty);
      return {
        ...line,
        qty,
        amount: roundMoney(qty * line.unitPrice),
      };
    });
}

function addGroup(groups, side, line) {
  const key = line.normalized.productKey;

  if (!groups.has(key)) {
    groups.set(key, {
      product_key: key,
      product_label: line.normalized.productLabel,
      item_description: line.normalized.itemDescription,
      category: line.normalized.category,
      pdf: [],
      qb: [],
    });
  }

  groups.get(key)[side].push(line);
}

function aggregateGroup(lines) {
  const qty = lines.reduce((sum, line) => sum + toNumber(line.qty), 0);
  const amount = roundMoney(lines.reduce((sum, line) => sum + toNumber(line.amount), 0));
  const unitPriceList = uniqueNumbers(lines.map((line) => line.unitPrice));
  const unitPrice = unitPriceList.length === 1 ? unitPriceList[0] : null;

  return {
    lines,
    lineRefs: lineRefs(lines),
    itemIds: joinValues(lines.map((line) => line.item_id)),
    descriptions: descriptions(lines),
    itemDescriptions: itemDescriptions(lines),
    qty,
    unitPrice,
    unitPriceList,
    amount,
  };
}

function lineSortValue(line) {
  const numeric = Number(line?.line);

  return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
}

function pairEligible(pdfLine, qbLine) {
  const pdfHand = pdfLine?.normalized?.comparisonHand;
  const qbHand = qbLine?.normalized?.comparisonHand;

  if (pdfHand && qbHand && pdfHand !== qbHand) return false;

  return true;
}

function linePairScore(pdfLine, qbLine) {
  let score = 0;
  const pdfModel = pdfLine?.normalized?.doorModel;
  const qbModel = qbLine?.normalized?.doorModel;

  if (pdfModel && qbModel) {
    score += pdfModel === qbModel ? 2000 : -2000;
  }

  score += qtyMatch(pdfLine.qty, qbLine.qty)
    ? 1000
    : -Math.abs(toNumber(pdfLine.qty) - toNumber(qbLine.qty)) * 25;
  score += moneyMatch(pdfLine.unitPrice, qbLine.unitPrice)
    ? 500
    : -Math.abs(toNumber(pdfLine.unitPrice) - toNumber(qbLine.unitPrice)) * 5;
  score += moneyMatch(pdfLine.amount, qbLine.amount)
    ? 250
    : -Math.abs(toNumber(pdfLine.amount) - toNumber(qbLine.amount)) / 5;

  return score;
}

function pairGroupLines(pdfLines, qbLines) {
  const candidates = [];
  const usedPdf = new Set();
  const usedQb = new Set();

  for (let pdfIndex = 0; pdfIndex < pdfLines.length; pdfIndex += 1) {
    for (let qbIndex = 0; qbIndex < qbLines.length; qbIndex += 1) {
      const pdfLine = pdfLines[pdfIndex];
      const qbLine = qbLines[qbIndex];

      if (!pairEligible(pdfLine, qbLine)) continue;

      candidates.push({
        pdfIndex,
        qbIndex,
        pdfLine,
        qbLine,
        score: linePairScore(pdfLine, qbLine),
      });
    }
  }

  candidates.sort((a, b) => (
    b.score - a.score ||
    lineSortValue(a.pdfLine) - lineSortValue(b.pdfLine) ||
    lineSortValue(a.qbLine) - lineSortValue(b.qbLine)
  ));

  const pairs = [];

  for (const candidate of candidates) {
    if (usedPdf.has(candidate.pdfIndex) || usedQb.has(candidate.qbIndex)) continue;

    usedPdf.add(candidate.pdfIndex);
    usedQb.add(candidate.qbIndex);
    pairs.push(candidate);
  }

  pairs.sort((a, b) => lineSortValue(a.pdfLine) - lineSortValue(b.pdfLine));

  return {
    pairs,
    pdfOnly: pdfLines.filter((_, index) => !usedPdf.has(index)),
    qbOnly: qbLines.filter((_, index) => !usedQb.has(index)),
  };
}

function identityConflicts(pdfLine, qbLine) {
  const conflicts = [];
  const pdfModel = pdfLine?.normalized?.doorModel;
  const qbModel = qbLine?.normalized?.doorModel;

  if (pdfModel && qbModel && pdfModel !== qbModel) {
    conflicts.push({
      field: 'door_model',
      pdf_value: pdfModel,
      qb_value: qbModel,
    });
  }

  return conflicts;
}

function buildMatchedRow(group, pdfAgg, qbAgg) {
  const isLouver = String(group.product_key || '').startsWith('INTERIOR_DOOR_LOUVER|');

  return {
    status: 'MATCHED',
    match_type: 'ONE_TO_ONE_PRODUCT',
    match_rule: isLouver ? 'LOUVER_ONE_TO_ONE_QTY_RATE_TOTAL' : 'SAME_PRODUCT_QTY_UNIT_TOTAL',
    product_key: group.product_key,
    product_label: group.product_label,
    item_description: group.item_description || group.product_label,
    pdf_line: pdfAgg.lineRefs,
    pdf_item_id: pdfAgg.itemIds,
    pdf_item_description: pdfAgg.itemDescriptions,
    pdf_description: pdfAgg.descriptions,
    pdf_qty: pdfAgg.qty,
    pdf_unit_price: pdfAgg.unitPrice,
    pdf_extd_price: pdfAgg.amount,
    qb_line: qbAgg.lineRefs,
    qb_item_description: qbAgg.itemDescriptions,
    qb_description: qbAgg.descriptions,
    qb_qty: qbAgg.qty,
    qb_rate: qbAgg.unitPrice,
    qb_amount: qbAgg.amount,
    variance: roundMoney(pdfAgg.amount - qbAgg.amount),
    match_score: 100,
    match_similarity: 1,
    message: isLouver
      ? 'Louver door matched one-to-one by size, thickness, model, quantity, unit price, and total; QuickBooks hand may be omitted.'
      : 'Same product, quantity, unit price, and total.',
  };
}

function buildDescriptionMismatchRow(group, pdfAgg, qbAgg, conflicts) {
  return {
    type: 'DESCRIPTION_MISMATCH',
    source: 'BOTH',
    product_key: group.product_key,
    product_label: group.product_label,
    item_description: group.item_description || group.product_label,
    pdf_line: pdfAgg.lineRefs,
    pdf_item_id: pdfAgg.itemIds,
    pdf_item_description: pdfAgg.itemDescriptions,
    pdf_description: pdfAgg.descriptions,
    pdf_qty: pdfAgg.qty,
    pdf_unit_price: pdfAgg.unitPrice,
    pdf_extd_price: pdfAgg.amount,
    qb_line: qbAgg.lineRefs,
    qb_item_description: qbAgg.itemDescriptions,
    qb_description: qbAgg.descriptions,
    qb_qty: qbAgg.qty,
    qb_rate: qbAgg.unitPrice,
    qb_amount: qbAgg.amount,
    description_differences: conflicts,
    variance: roundMoney(pdfAgg.amount - qbAgg.amount),
    message: conflicts.map((conflict) => (
      `${conflict.field} differs: PDF=${conflict.pdf_value}, QuickBooks=${conflict.qb_value}.`
    )).join(' '),
  };
}

function buildDiscrepancyRow(group, pdfAgg, qbAgg) {
  const hasPdf = pdfAgg.lines.length > 0;
  const hasQb = qbAgg.lines.length > 0;

  if (!hasPdf) {
    return {
      type: 'LINE_NOT_FOUND_IN_PDF',
      source: 'QB',
      product_key: group.product_key,
      product_label: group.product_label,
      item_description: group.item_description || group.product_label,
      pdf_line: null,
      pdf_item_description: null,
      pdf_description: null,
      pdf_qty: null,
      pdf_unit_price: null,
      pdf_extd_price: null,
      qb_line: qbAgg.lineRefs,
      qb_item_description: qbAgg.itemDescriptions,
      qb_description: qbAgg.descriptions,
      qb_qty: qbAgg.qty,
      qb_rate: qbAgg.unitPrice,
      qb_amount: qbAgg.amount,
      variance: roundMoney(0 - qbAgg.amount),
      message: `Product found in QuickBooks but not in PDF: ${group.product_label}.`,
    };
  }

  if (!hasQb) {
    return {
      type: 'LINE_NOT_FOUND_IN_QB',
      source: 'PDF',
      product_key: group.product_key,
      product_label: group.product_label,
      item_description: group.item_description || group.product_label,
      pdf_line: pdfAgg.lineRefs,
      pdf_item_id: pdfAgg.itemIds,
      pdf_item_description: pdfAgg.itemDescriptions,
      pdf_description: pdfAgg.descriptions,
      pdf_qty: pdfAgg.qty,
      pdf_unit_price: pdfAgg.unitPrice,
      pdf_extd_price: pdfAgg.amount,
      qb_line: null,
      qb_item_description: null,
      qb_description: null,
      qb_qty: null,
      qb_rate: null,
      qb_amount: null,
      variance: pdfAgg.amount,
      message: `Product found in PDF but not in QuickBooks: ${group.product_label}.`,
    };
  }

  const qtyOk = qtyMatch(pdfAgg.qty, qbAgg.qty);
  const unitOk = hasValue(pdfAgg.unitPrice) && hasValue(qbAgg.unitPrice) && moneyMatch(pdfAgg.unitPrice, qbAgg.unitPrice);
  const amountOk = moneyMatch(pdfAgg.amount, qbAgg.amount);
  const qtyDiff = pdfAgg.qty - qbAgg.qty;
  const amountDiff = roundMoney(pdfAgg.amount - qbAgg.amount);

  let type = 'LINE_MISMATCH';
  let message = `Same product but values differ: ${group.product_label}.`;

  if (!qtyOk && unitOk) {
    type = 'QTY_MISMATCH';
    message = qtyDiff > 0
      ? `Same product and unit price, but PDF has ${roundMoney(qtyDiff)} more than QuickBooks.`
      : `Same product and unit price, but QuickBooks has ${roundMoney(Math.abs(qtyDiff))} more than PDF.`;
  } else if (qtyOk && !unitOk) {
    type = 'PRICE_MISMATCH';
    message = 'Same product and quantity, but unit price differs.';
  } else if (qtyOk && unitOk && !amountOk) {
    type = 'TOTAL_MISMATCH';
    message = 'Same product, quantity, and unit price, but total differs.';
  } else if (!qtyOk && !unitOk) {
    type = 'QTY_PRICE_MISMATCH';
    message = 'Same product, but quantity and unit price differ.';
  }

  return {
    type,
    source: 'BOTH',
    product_key: group.product_key,
    product_label: group.product_label,
    item_description: group.item_description || group.product_label,
    pdf_line: pdfAgg.lineRefs,
    pdf_item_id: pdfAgg.itemIds,
    pdf_item_description: pdfAgg.itemDescriptions,
    pdf_description: pdfAgg.descriptions,
    pdf_qty: pdfAgg.qty,
    pdf_unit_price: pdfAgg.unitPrice,
    pdf_extd_price: pdfAgg.amount,
    qb_line: qbAgg.lineRefs,
    qb_item_description: qbAgg.itemDescriptions,
    qb_description: qbAgg.descriptions,
    qb_qty: qbAgg.qty,
    qb_rate: qbAgg.unitPrice,
    qb_amount: qbAgg.amount,
    qty_difference: roundMoney(qtyDiff),
    excess_side: qtyOk ? null : (qtyDiff > 0 ? 'PDF' : 'QB'),
    amount_difference: amountDiff,
    variance: amountDiff,
    message,
  };
}

function buildFinancialDescriptionConflicts(discrepancies) {
  const pdfOnly = discrepancies.filter((line) => line.type === 'LINE_NOT_FOUND_IN_QB');
  const qbOnly = discrepancies.filter((line) => line.type === 'LINE_NOT_FOUND_IN_PDF');
  const conflicts = [];

  for (const pdfLine of pdfOnly) {
    for (const qbLine of qbOnly) {
      if (
        qtyMatch(pdfLine.pdf_qty, qbLine.qb_qty) &&
        moneyMatch(pdfLine.pdf_unit_price, qbLine.qb_rate) &&
        moneyMatch(pdfLine.pdf_extd_price, qbLine.qb_amount)
      ) {
        conflicts.push({
          type: 'FINANCIALS_MATCH_DESCRIPTION_DIFF',
          severity: 'INFO',
          pdf_line: pdfLine.pdf_line,
          qb_line: qbLine.qb_line,
          pdf_item_description: pdfLine.pdf_item_description,
          qb_item_description: qbLine.qb_item_description,
          pdf_description: pdfLine.pdf_description,
          qb_description: qbLine.qb_description,
          message: 'Quantity and price match, but normalized descriptions are different. This is not an automatic match.',
        });
      }
    }
  }

  return conflicts;
}

const pdfLines = (Array.isArray(pdfData.line_items) ? pdfData.line_items : []).map(normalizePdfLine);
const qbLines = (Array.isArray(qbData.qb_line_items) ? qbData.qb_line_items : []).map(normalizeQbLine);
const bundleMatches = matchBypassBundles(pdfLines, qbLines);
const groups = new Map();

for (const line of residualPdfLines(pdfLines)) {
  addGroup(groups, 'pdf', line);
}

for (const line of qbLines.filter((qbLine) => !qbLine.used)) {
  addGroup(groups, 'qb', line);
}

const matched_lines = [...bundleMatches];
const discrepancias = [];
const comparison_rows = [...bundleMatches];

for (const group of [...groups.values()].sort((a, b) => String(a.product_key).localeCompare(String(b.product_key)))) {
  const { pairs, pdfOnly, qbOnly } = pairGroupLines(group.pdf, group.qb);

  for (const { pdfLine, qbLine } of pairs) {
    const pdfAgg = aggregateGroup([pdfLine]);
    const qbAgg = aggregateGroup([qbLine]);
    const conflicts = identityConflicts(pdfLine, qbLine);
    const isMatch = (
      conflicts.length === 0 &&
      qtyMatch(pdfAgg.qty, qbAgg.qty) &&
      hasValue(pdfAgg.unitPrice) &&
      hasValue(qbAgg.unitPrice) &&
      moneyMatch(pdfAgg.unitPrice, qbAgg.unitPrice) &&
      moneyMatch(pdfAgg.amount, qbAgg.amount)
    );
    const row = conflicts.length > 0
      ? buildDescriptionMismatchRow(group, pdfAgg, qbAgg, conflicts)
      : isMatch
        ? buildMatchedRow(group, pdfAgg, qbAgg)
        : buildDiscrepancyRow(group, pdfAgg, qbAgg);

    if (isMatch) matched_lines.push(row);
    else discrepancias.push(row);

    comparison_rows.push(row);
  }

  for (const pdfLine of pdfOnly) {
    const row = buildDiscrepancyRow(group, aggregateGroup([pdfLine]), aggregateGroup([]));
    discrepancias.push(row);
    comparison_rows.push(row);
  }

  for (const qbLine of qbOnly) {
    const row = buildDiscrepancyRow(group, aggregateGroup([]), aggregateGroup([qbLine]));
    discrepancias.push(row);
    comparison_rows.push(row);
  }
}

const ai_review_items = [
  ...discrepancias.filter((line) => (
    line.type === 'LINE_NOT_FOUND_IN_QB' ||
    line.type === 'LINE_NOT_FOUND_IN_PDF' ||
    line.type === 'LINE_MISMATCH' ||
    line.type === 'DESCRIPTION_MISMATCH'
  )),
  ...buildFinancialDescriptionConflicts(discrepancias),
];

const totalPdf = roundMoney(pdfData.sub_total ?? pdfLines.reduce((sum, line) => sum + line.amount, 0));
const totalQb = roundMoney(qbData.qb_total ?? qbLines.reduce((sum, line) => sum + line.amount, 0));
const totalsMatch = moneyMatch(totalPdf, totalQb);
const verified = discrepancias.length === 0 && totalsMatch;
const status = verified ? 'MATCH_TOTAL' : 'REVIEW';

const summary = {
  pdf_lines_count: pdfLines.length,
  qb_lines_count: qbLines.length,
  matched_lines_count: matched_lines.length,
  discrepancies_count: discrepancias.length,
  qty_mismatches_count: discrepancias.filter((line) => String(line.type).includes('QTY')).length,
  price_mismatches_count: discrepancias.filter((line) => String(line.type).includes('PRICE')).length,
  description_mismatches_count: discrepancias.filter((line) => line.type === 'DESCRIPTION_MISMATCH').length,
  pdf_not_in_qb: discrepancias.filter((line) => line.type === 'LINE_NOT_FOUND_IN_QB').length,
  qb_not_in_pdf: discrepancias.filter((line) => line.type === 'LINE_NOT_FOUND_IN_PDF').length,
  bundle_matches_count: bundleMatches.length,
  ai_review_items_count: ai_review_items.length,
  total_pdf: totalPdf,
  total_qb: totalQb,
  total_difference: roundMoney(totalPdf - totalQb),
  totals_match: totalsMatch,
};

return [{
  json: {
    po_number: pdfData.po_number || qbData.qb_po_number || null,
    supplier: pdfData.supplier || qbData.qb_vendor_name || null,
    job: qbData.qb_job_name || null,
    phaseLots: qbData.qb_phase_lots || null,
    required_date: qbData.qb_required_date || null,
    order_date: pdfData.order_date || null,
    ship_date: pdfData.ship_date || null,
    totalPdf,
    totalQb,
    status,
    verified,
    final_status: status,
    final_verified: verified,
    message: verified
      ? 'PDF and QuickBooks match by product, quantity, unit price, and total.'
      : 'Review required. One or more product-level differences were found.',
    comparison_rules: [
      'MATCH only when normalized product description, quantity, unit price, and total match.',
      `Dimension descriptions may differ by at most ${DIMENSION_TOL_INCHES} inch when comparing extracted sizes.`,
      'Width/height formats such as 2-8, 2/8, 2/10, 6-8, 6/8, 8-0, and 8/0 are normalized before comparison.',
      'S/B, SB, and SINGLE BORE normalize to SINGLE_BORE; D/B, DB, DBL BORE, and DOUBLE BORE normalize to DOUBLE_BORE.',
      '20min, 20/MIN, 20MIN, and APPLY 20MIN LABEL normalize to 20MIN_FIRE_LABEL.',
      'Interior doors and prefit wood jambs use direct hand matching; Therma-Tru exterior entry doors and entry units with metal/Timely prep use reverse hand logic between PDF and QuickBooks.',
      'Louver doors are reconciled one-to-one by size, thickness, model/style, quantity, unit price, and total; missing QuickBooks LH/RH does not block a match.',
      'Repeated product keys are paired one-to-one and are never aggregated, except for the explicit bypass track + hardware bundle rule.',
      'Explicit door model differences remain DESCRIPTION_MISMATCH even when financial values match.',
      'Matched PDF doors containing LOUVER/LOUVERED/LVR or a 1-3/4-inch thickness require a QuickBooks swing marker (SWING IN, SI, S/I, SWING OUT, SO, or S/O); a missing marker remains a match but creates an actionable warning during final cleanup.',
      'Same product plus same unit price but different quantity becomes QTY_MISMATCH.',
      'Same product plus same quantity but different unit price becomes PRICE_MISMATCH.',
      'Financial totals alone never create a product match.',
      'Bypass track plus hardware kit is the only allowed automatic bundle match.',
    ],
    normalization_dictionary: {
      size: ['2-8 = 2/8', '2-10 = 2/10', '6-8 = 6/8', '8-0 = 8/0', '80 inches = 6/8', '96 inches = 8/0'],
      prep: ['S/B = SB = SINGLE BORE = SINGLE_BORE', 'D/B = DB = DBL BORE = DOUBLE BORE = DOUBLE_BORE'],
      fire: ['20min Rating = 20MIN = 20/MIN = APPLY 20MIN LABEL = 20MIN_FIRE_LABEL'],
      casing: ['CSG = CASING', '120MUL = 120CSG = 120', '711 = 711'],
      productTypes: ['ENTRY_UNIT', 'INTERIOR_DOOR', 'INTERIOR_DOOR_LOUVER', 'PREFIT_JAMB', 'CASED_OPENING', 'BYPASS_TRACK', 'BYPASS_HARDWARE', 'TRANSPORT'],
      louver: ['LOUVER = LOUVERED = LVR when the surrounding door identity also matches'],
      doorSwing: ['Required when the matched PDF door is LOUVER/LOUVERED/LVR or 1-3/4 inch thick', 'SWING IN = SI = S/I', 'SWING OUT = SO = S/O', 'Missing swing marker creates a warning without rejecting the match'],
    },
    dimension_tolerance_inches: DIMENSION_TOL_INCHES,
    matched_lines,
    discrepancias,
    comparison_rows,
    warnings: [],
    ai_review_items,
    ai_review_payload: {
      instruction: `Review only ambiguous description normalization using individual normalized and raw line descriptions. Do not override numeric mismatches. Do not aggregate repeated product keys or combine different products just because totals match. Dimension values may differ by at most ${DIMENSION_TOL_INCHES} inch after extraction.`,
      items: ai_review_items,
    },
    summary,
    pdfData,
    qbData,
    reconciledAt: new Date().toISOString(),
  },
  binary,
}];
