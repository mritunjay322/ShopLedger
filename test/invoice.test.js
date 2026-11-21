const assert = require('node:assert/strict');
const test = require('node:test');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');
const reports = require('../lib/reports');

const cases = [
  {
    name: '#1001 invoice uses 5% and 12% for uncouponed HSN lines',
    order: {
      id: 1001,
      coupon: '',
      items: [
        { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 2 },
        { id: 2, name: 'Ghee', hsn: '0405', price: 300, qty: 1 },
      ],
    },
    checkout: {
      subtotal: 500, discount: 0, taxable: 500, tax: 46, cgst: 23, sgst: 23, total: 546,
      lines: [{ gstPercent: 5, tax: 10 }, { gstPercent: 12, tax: 36 }],
    },
    invoice: {
      subtotal: 500, discount: 0, tax: 46, cgst: 23, sgst: 23, total: 546,
      rows: [{ gstPercent: 5, lineTax: 10 }, { gstPercent: 12, lineTax: 36 }],
    },
  },
  {
    name: '#1002 invoice applies SAVE10 before GST',
    order: {
      id: 1002,
      coupon: 'SAVE10',
      items: [
        { id: 1, name: 'Rice', hsn: '1006', price: 300, qty: 2 },
        { id: 2, name: 'Sunflower oil', hsn: '1512', price: 420, qty: 1 },
      ],
    },
    checkout: {
      subtotal: 1020, discount: 102, taxable: 918, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9,
      lines: [{ gstPercent: 5, tax: 27 }, { gstPercent: 5, tax: 18.9 }],
    },
    invoice: {
      subtotal: 1020, discount: 102, tax: 45.9, cgst: 22.95, sgst: 22.95, total: 963.9,
      rows: [{ gstPercent: 5, lineTax: 27 }, { gstPercent: 5, lineTax: 18.9 }],
    },
  },
  {
    name: '#1004 invoice honours the SAVE10 cap',
    order: {
      id: 1004,
      coupon: 'SAVE10',
      items: [{ id: 1, name: 'Groundnut oil', hsn: '1508', price: 1120, qty: 2 }],
    },
    checkout: {
      subtotal: 2240, discount: 150, taxable: 2090, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5,
      lines: [{ gstPercent: 5, tax: 104.5 }],
    },
    invoice: {
      subtotal: 2240, discount: 150, tax: 104.5, cgst: 52.25, sgst: 52.25, total: 2194.5,
      rows: [{ gstPercent: 5, lineTax: 104.5 }],
    },
  },
  {
    name: '#1008 invoice matches checkout for uncouponed 18% lines',
    order: {
      id: 1008,
      coupon: '',
      items: [
        { id: 1, name: 'Tea', hsn: '0902', price: 150, qty: 2, gstRate: 18 },
        { id: 2, name: 'Syrup', hsn: '2106', price: 200, qty: 1 },
      ],
    },
    checkout: {
      subtotal: 500, discount: 0, taxable: 500, tax: 90, cgst: 45, sgst: 45, total: 590,
      lines: [{ gstPercent: 18, tax: 54 }, { gstPercent: 18, tax: 36 }],
    },
    invoice: {
      subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590,
      rows: [{ gstPercent: 18, lineTax: 54 }, { gstPercent: 18, lineTax: 36 }],
    },
  },
];

for (const fixture of cases) {
  test('CURRENT BEHAVIOUR: ' + fixture.name, () => {
    const order = fixture.order;
    const { lines, ...checkout } = pricing.computeTotals(order.items, order.coupon);
    const { rows, ...printed } = invoice.computeInvoiceFigures({
      ...order,
      subtotal: checkout.subtotal,
      discount: checkout.discount,
      tax: checkout.tax,
      total: checkout.total,
    });

    assert.deepStrictEqual({
      ...checkout,
      lines: lines.map(({ gstPercent, tax }) => ({ gstPercent, tax })),
    }, fixture.checkout, 'checkout figures');

    assert.deepStrictEqual({
      ...printed,
      rows: rows.map(({ gstPercent, lineTax }) => ({ gstPercent, lineTax })),
    }, fixture.invoice, 'invoice figures');
  });
}

test('invoice prints billed totals and per-line HSN GST for a capped coupon', () => {
  const order = {
    id: 1,
    coupon: 'SAVE10',
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 600, qty: 2 },
      { id: 2, name: 'Ghee', hsn: '0405', price: 800, qty: 1 },
      { id: 3, name: 'Tea', hsn: '0902', price: 400, qty: 1 },
    ],
    subtotal: 2400,
    discount: 150,
    tax: 213.75,
    total: 2463.75,
  };

  const { rows, ...totals } = invoice.computeInvoiceFigures(order);
  assert.deepStrictEqual(totals, {
    subtotal: 2400, discount: 150, tax: 213.75, cgst: 106.88, sgst: 106.87, total: 2463.75,
  });
  assert.deepStrictEqual(rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [5, 56.25],
    [12, 90],
    [18, 67.50],
  ]);

  const html = invoice.render(order);
  assert.match(html, /Gross Subtotal<\/td><td[^>]*>₹2400\.00<\/td>/);
  assert.match(html, /Total GST\)<\/td><td[^>]*>₹213\.75<\/td>/);
  assert.match(html, /Coupon Discount \(SAVE10\)<\/td><td[^>]*>-₹150\.00<\/td>/);
  assert.match(html, /Invoice Total<\/td><td[^>]*>₹2463\.75<\/td>/);
  assert.match(html, /<td>1006<\/td>(?:<td[^>]*>[^<]*<\/td>){2}<td class="r">5%<\/td><td class="r">₹56\.25<\/td>/);
  assert.match(html, /<td>0405<\/td>(?:<td[^>]*>[^<]*<\/td>){2}<td class="r">12%<\/td><td class="r">₹90\.00<\/td>/);
  assert.match(html, /<td>0902<\/td>(?:<td[^>]*>[^<]*<\/td>){2}<td class="r">18%<\/td><td class="r">₹67\.50<\/td>/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);

  const legacyOrder = {
    id: 2,
    date: '21/07/2021',
    coupon: '',
    items: [
      { id: 1, name: 'Rice', hsn: '1006', price: 100.03, qty: 1 },
      { id: 2, name: 'Ghee', hsn: '0405', price: 100.03, qty: 1 },
    ],
    subtotal: 200.06,
    discount: 0,
    tax: 36.01,
    total: 236.07,
  };
  const expiredCouponOrder = {
    id: 3,
    coupon: 'DIWALI20',
    items: [{ id: 3, name: 'Tea', hsn: '0902', price: 1250, qty: 1 }],
    subtotal: 1250,
    discount: 250,
    tax: 180,
    total: 1180,
  };
  const wrongTaxOrder = { ...order, id: 4, tax: 213.76 };
  const legacyCouponOrder = {
    id: 5,
    date: '21/07/2021',
    coupon: 'SAVE10',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 500.03, qty: 1 }],
    subtotal: 500.03,
    discount: 50,
    tax: 81,
    total: 531.03,
  };
  const legacyRoundingOrder = {
    id: 6,
    date: '2021-07-21',
    items: [{ id: 1, name: 'Rice', hsn: '1006', price: 100.25, qty: 1 }],
    subtotal: 100.25,
    discount: 0,
    tax: 18.04,
    total: 118.29,
  };
  const report = reports.getGstReconciliation({
    orders: [order, legacyOrder, expiredCouponOrder, wrongTaxOrder, legacyCouponOrder, legacyRoundingOrder],
  });

  assert.equal(report.mismatchCount, 1);
  assert.deepStrictEqual(report.rows.map(({ orderId, matched }) => [orderId, matched]), [
    [1, true], [2, true], [3, true], [4, false], [5, true], [6, true],
  ]);
  const legacy = invoice.computeInvoiceFigures(legacyOrder);
  assert.deepStrictEqual(legacy.rows.map(({ gstPercent, lineTax }) => [gstPercent, lineTax]), [
    [18, 18.01], [18, 18],
  ]);
  assert.match(invoice.render(legacyOrder), /Invoice Total<\/td><td[^>]*>₹236\.07<\/td>/);
  assert.match(invoice.render(expiredCouponOrder), /Coupon Discount \(DIWALI20\)<\/td><td[^>]*>-₹250\.00<\/td>/);
  assert.match(invoice.render(expiredCouponOrder), /Invoice Total<\/td><td[^>]*>₹1180\.00<\/td>/);
});
