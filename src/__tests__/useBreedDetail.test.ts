import { DETAIL_STALE_MS, isDetailStale } from '@/hooks/useBreedDetail';

import { makeBreed, makeImage } from './helpers/factories';

const NOW = 1_700_000_000_000;

describe('isDetailStale', () => {
  it('is stale when missing, image-less, or older than a day', () => {
    expect(isDetailStale(undefined, NOW)).toBe(true);
    expect(isDetailStale({ breed: makeBreed({ updatedAt: NOW }), groupName: null, images: [] }, NOW)).toBe(true);
    expect(isDetailStale({ breed: makeBreed({ updatedAt: NOW - DETAIL_STALE_MS - 1 }), groupName: null, images: [makeImage()] }, NOW)).toBe(true);
  });

  it('is fresh when written recently with images', () => {
    expect(isDetailStale({ breed: makeBreed({ updatedAt: NOW - 60_000 }), groupName: null, images: [makeImage()] }, NOW)).toBe(false);
  });
});
