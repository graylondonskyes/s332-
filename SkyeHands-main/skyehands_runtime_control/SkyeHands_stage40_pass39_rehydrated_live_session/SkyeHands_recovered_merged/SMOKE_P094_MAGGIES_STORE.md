# P094 Smoke Proof — Maggies Store Behavioral

Generated: 2026-04-27T17:43:12.091Z
Result: **PASS** | 21/21 assertions

## Assertions
- ✅ create product returns 201
- ✅ create product ok:true
- ✅ product has id
- ✅ list products returns 200
- ✅ list includes new product
- ✅ get product returns 200
- ✅ get product returns correct sku
- ✅ add to cart returns 200
- ✅ cart has item
- ✅ cart total > 0
- ✅ checkout returns 201
- ✅ checkout ok:true
- ✅ checkout has orderId
- ✅ checkout total > 0
- ✅ order status pending_payment
- ✅ cart cleared after checkout
- ✅ get order returns 200
- ✅ order matches checkout
- ✅ order email matches
- ✅ update order status returns 200
- ✅ order status updated

## Coverage
- ✅ Product create + list + get
- ✅ Cart add + total calculation
- ✅ Checkout creates order and clears cart
- ✅ Order lookup and status update