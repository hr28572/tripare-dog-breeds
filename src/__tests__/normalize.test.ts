import { normalizeBreed, normalizeBreeds, normalizeGroup } from '@/api/normalize';
import type { ApiBreedResource } from '@/types/breed';

import { allBreeds, groupsCollection } from './helpers/fixtures';

const NOW = 1_700_000_000_000;

describe('normalizeBreeds (real 283-breed fixture)', () => {
  const result = normalizeBreeds(allBreeds, NOW);

  it('parses every breed', () => {
    expect(result.failures).toEqual([]);
    expect(result.breeds).toHaveLength(283);
  });

  it('produces thumb/medium/large rows for every image', () => {
    const imagesInApi = allBreeds.reduce((n, b) => n + (b.attributes.images?.length ?? 0), 0);
    expect(imagesInApi).toBe(2354);
    expect(result.images).toHaveLength(imagesInApi * 3);
    expect(new Set(result.images.map((i) => i.id)).size).toBe(result.images.length);
  });

  it('assigns a size band to every breed', () => {
    const counts: Record<string, number> = {};
    for (const b of result.breeds) counts[b.sizeBand ?? 'null'] = (counts[b.sizeBand ?? 'null'] ?? 0) + 1;
    expect(counts.null).toBeUndefined();
    expect(Object.keys(counts).sort()).toEqual(['giant', 'large', 'medium', 'small']);
  });

  it('keeps nullable traits null instead of failing', () => {
    const noTraits = result.breeds.filter((b) => b.energy === null);
    expect(noTraits).toHaveLength(1);
    expect(noTraits[0].temperament).toEqual([]);
  });

  it('maps a known breed faithfully', () => {
    const affen = result.breeds.find((b) => b.name === 'Affenpinscher')!;
    expect(affen).toMatchObject({
      lifeMin: 14,
      lifeMax: 16,
      maleWeightMax: 6,
      originCountry: 'Germany',
      hypoallergenic: true,
      coatLength: 'short',
      coatType: 'wire',
      sizeBand: 'small',
      energy: 3,
      exerciseMinutes: 30,
      groupId: 'f56dc4b1-ba1a-4454-8ce2-bd5d41404a0c',
      updatedAt: NOW,
    });
    expect(affen.otherNames).toContain('Affen');
    expect(affen.recognizedBy).toContain('AKC');
    expect(affen.temperament).toContain('playful');
  });
});

describe('normalizeBreed validation', () => {
  it('rejects records without an id or name', () => {
    const noName = { id: 'x', type: 'breed', attributes: {} } as ApiBreedResource;
    const noId = { type: 'breed', attributes: { name: 'Y' } } as unknown as ApiBreedResource;
    expect(normalizeBreed(noName, NOW)).toEqual({ ok: false, failure: { id: 'x', name: null, reason: 'missing name' } });
    expect(normalizeBreed(noId, NOW)).toMatchObject({ ok: false, failure: { reason: 'missing id' } });
  });

  it('drops images without an id and falls back to url when a variant is missing', () => {
    const r = normalizeBreed(
      {
        id: 'b1',
        type: 'breed',
        attributes: {
          name: 'Test',
          images: [{ url: 'u' }, { id: 'i1', url: 'full', thumb: 't' }],
        },
      },
      NOW,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.images.map((i) => [i.variant, i.url])).toEqual([
      ['thumb', 't'],
      ['medium', 'full'],
      ['large', 'full'],
    ]);
  });
});

describe('normalizeGroup', () => {
  it('parses the groups fixture', () => {
    const rows = groupsCollection.data.map(normalizeGroup);
    expect(rows).toHaveLength(9);
    expect(rows.every((g) => g !== null)).toBe(true);
  });
});
