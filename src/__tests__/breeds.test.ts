import { dedupeById, fetchAllBreeds, fetchBreedById, fetchGroups, PartialBreedsError } from '@/api/breeds';
import { ApiError } from '@/api/client';

import { allBreeds, groupsCollection, jsonResponse, pageOf } from './helpers/fixtures';

const PAGE_SIZE = 50;

function pageNumber(url: string): number {
  return Number(new URL(url).searchParams.get('page[number]') ?? '1');
}

describe('fetchAllBreeds', () => {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('fetches all 6 pages and merges them', async () => {
    fetchMock.mockImplementation(async (url) => jsonResponse(pageOf(pageNumber(url), PAGE_SIZE)));
    const breeds = await fetchAllBreeds();
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(breeds).toHaveLength(283);
    expect(new Set(breeds.map((b) => b.id)).size).toBe(283);
  });

  it('dedupes breeds that appear on two pages', async () => {
    fetchMock.mockImplementation(async (url) => {
      const page = pageOf(pageNumber(url), PAGE_SIZE);
      if (pageNumber(url) === 2) page.data = [allBreeds[0], ...page.data];
      return jsonResponse(page);
    });
    const breeds = await fetchAllBreeds();
    expect(breeds).toHaveLength(283);
  });

  it('throws PartialBreedsError carrying fetched pages when one page fails', async () => {
    fetchMock.mockImplementation(async (url) =>
      pageNumber(url) === 4 ? jsonResponse({ error: 'boom' }, 503) : jsonResponse(pageOf(pageNumber(url), PAGE_SIZE)),
    );
    await expect(fetchAllBreeds()).rejects.toBeInstanceOf(PartialBreedsError);
    try {
      await fetchAllBreeds();
    } catch (error) {
      const partial = error as PartialBreedsError;
      expect(partial.failedPages).toEqual([4]);
      expect(partial.totalPages).toBe(6);
      expect(partial.fetched).toHaveLength(283 - 50);
      expect(partial.causes[0]).toBeInstanceOf(ApiError);
    }
  });

  it('propagates a plain ApiError when page 1 fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    await expect(fetchAllBreeds()).rejects.toMatchObject({ kind: 'http', status: 500, isRetryable: true });
  });
});

describe('fetchGroups / fetchBreedById', () => {
  it('returns groups and a single breed', async () => {
    global.fetch = jest.fn(async (url: string) =>
      url.includes('/groups') ? jsonResponse(groupsCollection) : jsonResponse({ data: allBreeds[0] }),
    ) as unknown as typeof fetch;
    expect(await fetchGroups()).toHaveLength(9);
    expect((await fetchBreedById(allBreeds[0].id)).id).toBe(allBreeds[0].id);
  });

  it('marks 404 as non-retryable', async () => {
    global.fetch = jest.fn(async () => jsonResponse({}, 404)) as unknown as typeof fetch;
    await expect(fetchBreedById('nope')).rejects.toMatchObject({ status: 404, isRetryable: false });
  });
});

describe('dedupeById', () => {
  it('keeps first occurrence and skips malformed entries', () => {
    const items = [{ id: 'a', v: 1 }, { id: 'b' }, { id: 'a', v: 2 }, null as unknown as { id: string }];
    expect(dedupeById(items)).toEqual([{ id: 'a', v: 1 }, { id: 'b' }]);
  });
});
