import type { BreedListRow } from '@/db/repository';
import type { Breed, BreedImage } from '@/db/schema';

export function makeBreed(overrides: Partial<Breed> = {}): Breed {
  return {
    id: 'b1',
    name: 'Affenpinscher',
    otherNames: ['Monkey Terrier', 'Affen'],
    description: 'A small, playful breed.',
    lifeMin: 14,
    lifeMax: 16,
    maleWeightMin: 4,
    maleWeightMax: 6,
    femaleWeightMin: 4,
    femaleWeightMax: 6,
    maleHeightMin: 23,
    maleHeightMax: 29,
    femaleHeightMin: 23,
    femaleHeightMax: 29,
    originEra: '17th century',
    originRegion: 'Central Europe',
    originCountry: 'Germany',
    hypoallergenic: true,
    coatLength: 'short',
    coatType: 'wire',
    coatColors: ['black', 'gray'],
    sizeBand: 'small',
    energy: 3,
    barking: 3,
    drooling: 1,
    grooming: 3,
    shedding: 2,
    trainability: 3,
    goodWithDogs: 3,
    goodWithChildren: 3,
    goodWithStrangers: 2,
    apartmentFriendly: 5,
    exerciseMinutes: 30,
    temperament: ['confident', 'playful'],
    recognizedBy: ['AKC', 'FCI'],
    sources: [{ url: 'https://example.com/std', title: 'Breed standard' }],
    groupId: 'g1',
    updatedAt: 1,
    ...overrides,
  };
}

export function makeRow(overrides: Partial<BreedListRow> = {}): BreedListRow {
  return {
    ...makeBreed(),
    groupName: 'Toy',
    thumbId: 'img1:thumb',
    thumbUrl: 'https://img/thumb',
    thumbLocalUri: null,
    thumbCached: false,
    ...overrides,
  };
}

export function makeImage(overrides: Partial<BreedImage> = {}): BreedImage {
  return {
    id: 'img1:medium',
    imageId: 'img1',
    breedId: 'b1',
    variant: 'medium',
    position: 0,
    url: 'https://img/medium',
    author: 'Ada',
    license: 'CC BY 2.0',
    licenseUrl: null,
    source: 'wikimedia_commons',
    sourceUrl: 'https://commons/x',
    cachedLocally: false,
    localUri: null,
    byteSize: null,
    lastAccessedAt: null,
    ...overrides,
  };
}
