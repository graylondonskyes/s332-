import test from 'node:test';
import assert from 'node:assert/strict';
import { moderateReview, normalizeProductReviewInput, productReviewRecord, summarizeProductReviews } from '../src/lib/reviews.js';

test('product reviews normalize, moderate, and summarize approved social proof', () => {
  const clean = moderateReview({ productId: 'prd_1', rating: 5, body: 'Excellent product and fast delivery.' }, { autoApproveMinRating: 4, minBodyLength: 8 });
  const flagged = moderateReview({ productId: 'prd_1', rating: 5, body: 'spam link' }, { blockedTerms: ['spam'] });
  const reviews = [
    productReviewRecord({ id: 'r1', product_id: 'prd_1', rating: clean.rating, status: clean.status, body: clean.body }),
    productReviewRecord({ id: 'r2', product_id: 'prd_1', rating: flagged.rating, status: flagged.status, body: flagged.body })
  ];
  const summary = summarizeProductReviews(reviews);
  assert.equal(normalizeProductReviewInput({ rating: 9 }).rating, 5);
  assert.equal(clean.status, 'approved');
  assert.equal(flagged.status, 'flagged');
  assert.equal(summary.approvedCount, 1);
  assert.equal(summary.averageRating, 5);
});
