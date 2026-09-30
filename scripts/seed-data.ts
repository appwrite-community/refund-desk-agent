// Demo data: people, orders, the refund policy, and a few requests that were
// resolved before the demo starts. Dates are relative to the moment you seed.

export const DEMO_PASSWORD = 'pourhaven-demo-2026';

export type Reason = 'damaged' | 'defective' | 'wrong_item' | 'changed_mind';

export type Person = { id: string; name: string; email: string };

export const STAFF: (Person & { roles: string[] })[] = [
  { id: 'maya-okafor', name: 'Maya Okafor', email: 'maya.okafor@example.com', roles: ['lead'] },
  { id: 'daniel-reyes', name: 'Daniel Reyes', email: 'daniel.reyes@example.com', roles: ['support'] },
];

export const CUSTOMERS: Person[] = [
  { id: 'priya-raman', name: 'Priya Raman', email: 'priya.raman@example.com' },
  { id: 'aiko-tanaka', name: 'Aiko Tanaka', email: 'aiko.tanaka@example.com' },
  { id: 'lucas-moreau', name: 'Lucas Moreau', email: 'lucas.moreau@example.com' },
  { id: 'tom-becker', name: 'Tom Becker', email: 'tom.becker@example.com' },
  { id: 'hannah-schulz', name: 'Hannah Schulz', email: 'hannah.schulz@example.com' },
  { id: 'grace-liu', name: 'Grace Liu', email: 'grace.liu@example.com' },
  { id: 'omar-haddad', name: 'Omar Haddad', email: 'omar.haddad@example.com' },
  { id: 'sam-patel', name: 'Sam Patel', email: 'sam.patel@example.com' },
];

export const CATALOG = {
  'CAR-600': { name: 'Glass carafe, 600 ml', priceCents: 3400 },
  'DRP-02': { name: 'Ceramic pour-over dripper', priceCents: 2800 },
  'KTL-09': { name: 'Gooseneck kettle, 0.9 L', priceCents: 12900 },
  'GRD-C40': { name: 'Conical burr grinder', priceCents: 24900 },
  'HGR-01': { name: 'Hand grinder', priceCents: 11900 },
  'SCL-01': { name: 'Digital brew scale', priceCents: 5900 },
  'MUG-2': { name: 'Double-wall glass mugs, set of 2', priceCents: 2400 },
  'FLT-100': { name: 'Paper filters, 100 pack', priceCents: 900 },
  'TMP-58': { name: 'Espresso tamper', priceCents: 3900 },
} as const;

export type Sku = keyof typeof CATALOG;

const CARDS = {
  visa: { cardBrand: 'Visa', cardLast4: '4242' },
  mastercard: { cardBrand: 'Mastercard', cardLast4: '4444' },
  amex: { cardBrand: 'Amex', cardLast4: '0005' },
};

export type Order = {
  number: string;
  customerId: string;
  items: { sku: Sku; quantity: number }[];
  placedDaysAgo: number;
  deliveredDaysAgo: number;
  card: keyof typeof CARDS;
};

export const cardFor = (order: Order) => CARDS[order.card];

/** The order row ID is the lowercase order number, for example ph-20417. */
export const orderId = (order: Order) => order.number.toLowerCase();

export const ORDERS: Order[] = [
  // Demo requests
  { number: 'PH-20417', customerId: 'priya-raman', items: [{ sku: 'CAR-600', quantity: 1 }, { sku: 'FLT-100', quantity: 2 }], placedDaysAgo: 8, deliveredDaysAgo: 5, card: 'visa' },
  { number: 'PH-20388', customerId: 'priya-raman', items: [{ sku: 'KTL-09', quantity: 1 }], placedDaysAgo: 12, deliveredDaysAgo: 9, card: 'visa' },
  { number: 'PH-19904', customerId: 'priya-raman', items: [{ sku: 'SCL-01', quantity: 1 }], placedDaysAgo: 70, deliveredDaysAgo: 66, card: 'visa' },
  { number: 'PH-20402', customerId: 'aiko-tanaka', items: [{ sku: 'GRD-C40', quantity: 1 }], placedDaysAgo: 15, deliveredDaysAgo: 12, card: 'mastercard' },
  { number: 'PH-20395', customerId: 'lucas-moreau', items: [{ sku: 'SCL-01', quantity: 1 }], placedDaysAgo: 17, deliveredDaysAgo: 14, card: 'amex' },
  { number: 'PH-20421', customerId: 'tom-becker', items: [{ sku: 'MUG-2', quantity: 1 }], placedDaysAgo: 6, deliveredDaysAgo: 3, card: 'mastercard' },
  { number: 'PH-19870', customerId: 'tom-becker', items: [{ sku: 'HGR-01', quantity: 1 }], placedDaysAgo: 52, deliveredDaysAgo: 48, card: 'mastercard' },
  { number: 'PH-20430', customerId: 'hannah-schulz', items: [{ sku: 'MUG-2', quantity: 1 }], placedDaysAgo: 7, deliveredDaysAgo: 4, card: 'visa' },
  { number: 'PH-20433', customerId: 'hannah-schulz', items: [{ sku: 'GRD-C40', quantity: 1 }], placedDaysAgo: 9, deliveredDaysAgo: 6, card: 'visa' },
  { number: 'PH-20436', customerId: 'hannah-schulz', items: [{ sku: 'DRP-02', quantity: 1 }], placedDaysAgo: 10, deliveredDaysAgo: 7, card: 'visa' },
  // Orders behind the resolved requests
  { number: 'PH-19512', customerId: 'tom-becker', items: [{ sku: 'DRP-02', quantity: 1 }], placedDaysAgo: 82, deliveredDaysAgo: 78, card: 'mastercard' },
  { number: 'PH-19733', customerId: 'tom-becker', items: [{ sku: 'TMP-58', quantity: 1 }], placedDaysAgo: 45, deliveredDaysAgo: 41, card: 'mastercard' },
  { number: 'PH-18977', customerId: 'hannah-schulz', items: [{ sku: 'TMP-58', quantity: 1 }], placedDaysAgo: 142, deliveredDaysAgo: 138, card: 'visa' },
  { number: 'PH-20105', customerId: 'grace-liu', items: [{ sku: 'KTL-09', quantity: 1 }], placedDaysAgo: 39, deliveredDaysAgo: 35, card: 'amex' },
  { number: 'PH-20261', customerId: 'grace-liu', items: [{ sku: 'CAR-600', quantity: 1 }, { sku: 'FLT-100', quantity: 1 }], placedDaysAgo: 26, deliveredDaysAgo: 23, card: 'amex' },
  { number: 'PH-19811', customerId: 'omar-haddad', items: [{ sku: 'HGR-01', quantity: 1 }], placedDaysAgo: 66, deliveredDaysAgo: 62, card: 'visa' },
  { number: 'PH-20198', customerId: 'omar-haddad', items: [{ sku: 'MUG-2', quantity: 2 }], placedDaysAgo: 31, deliveredDaysAgo: 28, card: 'visa' },
  { number: 'PH-20120', customerId: 'sam-patel', items: [{ sku: 'GRD-C40', quantity: 1 }], placedDaysAgo: 50, deliveredDaysAgo: 46, card: 'mastercard' },
  { number: 'PH-20233', customerId: 'sam-patel', items: [{ sku: 'SCL-01', quantity: 1 }], placedDaysAgo: 40, deliveredDaysAgo: 37, card: 'mastercard' },
];

export const POLICIES = [
  {
    id: 'overview',
    title: 'How refunds work',
    body: 'Ask for a refund from your order page within 30 days of delivery. Our refund agent reviews every request within a few minutes. It refunds small, clear cases right away and sends everything else to our support team, who reply within one business day.',
  },
  {
    id: 'automatic_refunds',
    title: 'Automatic refunds',
    body: 'We refund a request automatically when all of these are true: the item arrived damaged, stopped working, or is not what you ordered; it cost $50 or less; it was delivered in the last 30 days; the photo shows the problem you describe; and you had no other refund in the last 90 days. Our support team reviews every other request.',
  },
  {
    id: 'damaged_in_transit',
    title: 'Items damaged in transit',
    body: 'If an item arrives broken, cracked, or dented, send a photo that shows the damage within 30 days of delivery. You do not need to send it back, unless it cost more than $150. In that case we send you a return code and refund the item when it arrives.',
  },
  {
    id: 'defective',
    title: 'Items that stop working',
    body: 'Brewing gear has a one-year warranty against defects. Tell us what happened and add a photo. We may ask a question to rule out a simple fix, such as new batteries. Items that cost more than $150 are refunded after they arrive back with us.',
  },
  {
    id: 'wrong_item',
    title: 'Wrong item received',
    body: 'If we sent the wrong item, send a photo of what arrived. We refund the item you ordered. Items that cost more than $50 need to come back to us first.',
  },
  {
    id: 'changed_mind',
    title: 'Change of mind',
    body: 'You can return unused items in their original packaging within 30 days of delivery. Send the item back first. We refund the item price when it arrives. Return shipping is not refunded.',
  },
  {
    id: 'returns',
    title: 'Sending an item back',
    body: 'When a return is needed, your request page shows a return code and our address. Ship the item within 7 days. We check for it 7 days after we send the code and refund the item if it has arrived. If it has not arrived, we remind you once and check again 7 days later. If it still has not arrived, the request closes.',
  },
];

export type Outcome = 'auto_refund' | 'approved' | 'approved_after_return' | 'declined' | 'closed_no_return';

export type HistoryCase = {
  id: string;
  order: string;
  sku: Sku;
  reason: Reason;
  details: string;
  photo?: string;
  inspection?: string;
  askedDaysAgo: number;
  outcome: Outcome;
  review?: {
    recommendation: 'refund' | 'refund_after_return' | 'decline';
    findings: string[];
    concerns: string[];
    reasoning: string;
    decidedBy: string;
    staffNote?: string;
    customerMessage?: string;
    hoursLater: number;
  };
};

// Requests resolved before the demo, oldest first, so their numbers come first.
export const HISTORY: HistoryCase[] = [
  {
    id: 'seed-hannah-tamper',
    order: 'PH-18977',
    sku: 'TMP-58',
    reason: 'damaged',
    details: 'The base of the tamper is dented on one edge, so it does not sit flat in the basket.',
    photo: 'history-tamper-bent',
    inspection: 'A stainless steel espresso tamper with a visible dent and bent edge on its base. The photo shows the damage the customer describes.',
    askedDaysAgo: 135,
    outcome: 'auto_refund',
  },
  {
    id: 'seed-tom-dripper',
    order: 'PH-19512',
    sku: 'DRP-02',
    reason: 'damaged',
    details: 'The dripper arrived with a crack from the rim down the side, and a piece of the rim is missing.',
    photo: 'history-dripper-cracked',
    inspection: 'A white ceramic cone dripper with a crack running down from the rim and a chip missing from the rim. The photo shows the damage the customer describes.',
    askedDaysAgo: 76,
    outcome: 'auto_refund',
  },
  {
    id: 'seed-omar-grinder',
    order: 'PH-19811',
    sku: 'HGR-01',
    reason: 'changed_mind',
    details: 'I bought an electric grinder instead and never used this one.',
    askedDaysAgo: 58,
    outcome: 'declined',
    review: {
      recommendation: 'decline',
      findings: ['The customer says the hand grinder is unused.'],
      concerns: [
        'Change-of-mind refunds need the item back first.',
        'Delivered 62 days ago, outside the 30-day window for automatic refunds.',
        '$119.00 is above the $50.00 automatic refund limit.',
      ],
      reasoning: 'The change-of-mind policy allows returns within 30 days of delivery, and this order was delivered 62 days ago. The item is unused, but the window has passed. Recommend declining.',
      decidedBy: 'daniel-reyes',
      staffNote: 'Change-of-mind returns are only possible within 30 days of delivery.',
      customerMessage: 'Thanks for asking. We can only accept change-of-mind returns within 30 days of delivery, and your hand grinder arrived 62 days ago, so we cannot refund it.',
      hoursLater: 3,
    },
  },
  {
    id: 'seed-sam-grinder',
    order: 'PH-20120',
    sku: 'GRD-C40',
    reason: 'defective',
    details: 'The motor hums but the burrs do not turn anymore. It happened after about five weeks of daily use.',
    photo: 'history-grinder-defective',
    inspection: 'A white conical burr grinder on a counter with beans in the hopper. Nothing in the photo contradicts the description of a motor fault.',
    askedDaysAgo: 40,
    outcome: 'approved_after_return',
    review: {
      recommendation: 'refund_after_return',
      findings: [
        'Delivered 46 days ago, inside the one-year warranty.',
        'The photo shows the grinder and nothing contradicts the reported motor fault.',
        'No refunds in the last 12 months.',
      ],
      concerns: ['$249.00 is above the $50.00 automatic refund limit.', 'Delivered 46 days ago, outside the 30-day window for automatic refunds.'],
      reasoning: 'A motor that hums without turning the burrs is a defect covered by the one-year warranty. The grinder costs more than $150, so the policy asks for the item back before the refund. Recommend a refund after return.',
      decidedBy: 'maya-okafor',
      hoursLater: 5,
    },
  },
  {
    id: 'seed-tom-tamper',
    order: 'PH-19733',
    sku: 'TMP-58',
    reason: 'wrong_item',
    details: 'I ordered the espresso tamper but the box had a milk pitcher in it.',
    photo: 'history-milk-pitcher',
    inspection: 'An opened box with a stainless steel milk frothing pitcher inside. It is a different product than the espresso tamper that was ordered.',
    askedDaysAgo: 38,
    outcome: 'approved',
    review: {
      recommendation: 'refund',
      findings: ['The photo shows a milk pitcher, not the espresso tamper that was ordered.', 'Delivered 3 days before the request.'],
      concerns: ['The customer had 1 refund in the last 90 days.'],
      reasoning: 'The photo clearly shows a different product than the one ordered. The wrong-item policy refunds items under $50 without a return. Only the recent refund blocked the automatic refund.',
      decidedBy: 'daniel-reyes',
      hoursLater: 2,
    },
  },
  {
    id: 'seed-sam-scale',
    order: 'PH-20233',
    sku: 'SCL-01',
    reason: 'changed_mind',
    details: 'The scale is too big for my drip tray. It is unused and still in the box.',
    askedDaysAgo: 34,
    outcome: 'closed_no_return',
    review: {
      recommendation: 'refund_after_return',
      findings: ['Delivered 3 days before the request, inside the 30-day change-of-mind window.', 'The customer says the scale is unused and in its box.'],
      concerns: ['Change-of-mind refunds need the item back first.', '$59.00 is above the $50.00 automatic refund limit.'],
      reasoning: 'The request is inside the 30-day change-of-mind window. The policy asks for the item back before the refund. Recommend a refund after return.',
      decidedBy: 'maya-okafor',
      hoursLater: 4,
    },
  },
  {
    id: 'seed-grace-kettle',
    order: 'PH-20105',
    sku: 'KTL-09',
    reason: 'damaged',
    details: 'The lid is dented and does not close properly. The box had a crushed corner too.',
    photo: 'history-kettle-lid',
    inspection: 'A stainless steel gooseneck kettle with a visibly dented lid that does not sit flat. The photo shows the damage the customer describes.',
    askedDaysAgo: 33,
    outcome: 'approved',
    review: {
      recommendation: 'refund',
      findings: ['The photo shows a dented lid, matching the description.', 'Delivered 2 days before the request.', 'No refunds in the last 12 months.'],
      concerns: ['$129.00 is above the $50.00 automatic refund limit.'],
      reasoning: 'The damage is clear in the photo and the request came two days after delivery. The kettle costs less than $150, so no return is needed. Only the amount blocked the automatic refund.',
      decidedBy: 'maya-okafor',
      hoursLater: 2,
    },
  },
  {
    id: 'seed-omar-mugs',
    order: 'PH-20198',
    sku: 'MUG-2',
    reason: 'damaged',
    details: 'One of the four mugs has a crack down the outer wall.',
    photo: 'history-mug-cracked',
    inspection: 'A double-wall glass mug with a long crack down its outer wall. The photo shows the damage the customer describes.',
    askedDaysAgo: 26,
    outcome: 'declined',
    review: {
      recommendation: 'refund',
      findings: ['The photo shows a cracked mug.', 'Delivered 2 days before the request.'],
      concerns: ['$48.00 covers two sets, but the photo shows one cracked mug.'],
      reasoning: 'The order has two sets of mugs and the customer reports one cracked mug. The photo supports the damage. Staff may want to refund one set instead of both.',
      decidedBy: 'maya-okafor',
      staffNote: 'We sent a replacement mug set by express shipping instead of a refund.',
      customerMessage: 'We sent you a replacement set of mugs by express shipping instead of a refund. You do not need to return the cracked mug.',
      hoursLater: 1,
    },
  },
  {
    id: 'seed-grace-carafe',
    order: 'PH-20261',
    sku: 'CAR-600',
    reason: 'damaged',
    details: 'The spout of the carafe is chipped. I noticed it when I unpacked it.',
    photo: 'history-carafe-chipped',
    inspection: 'A glass carafe with a small chip missing from the pouring spout. The photo shows the damage the customer describes.',
    askedDaysAgo: 22,
    outcome: 'approved',
    review: {
      recommendation: 'refund',
      findings: ['The photo shows a chipped spout.', 'Delivered 1 day before the request.', '$34.00 is under the automatic refund limit.'],
      concerns: ['The customer had 1 refund in the last 90 days.'],
      reasoning: 'This is a small, clear damage claim with a matching photo. Only the refund for the kettle 11 days earlier blocked the automatic refund.',
      decidedBy: 'daniel-reyes',
      hoursLater: 1,
    },
  },
];
