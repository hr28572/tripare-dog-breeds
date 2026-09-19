import type { BreedListRow } from '@/db/repository';

export const UNGROUPED_TITLE = 'Other';

export type BreedListItem =
  | { type: 'header'; key: string; title: string; count: number }
  | { type: 'row'; key: string; breed: BreedListRow };

export interface BreedSections {
  items: BreedListItem[];
  /** indices into `items` that FlashList should pin while scrolling */
  stickyHeaderIndices: number[];
  groupCount: number;
}

/**
 * Turn rows (already ordered by group, then name) into a flat list with one
 * header item per group. Flat items + stickyHeaderIndices is how FlashList
 * does sections: a single recycled list, no nested SectionList.
 */
export function buildBreedSections(rows: BreedListRow[]): BreedSections {
  const byGroup = new Map<string, BreedListRow[]>();
  for (const row of rows) {
    const title = row.groupName ?? UNGROUPED_TITLE;
    const bucket = byGroup.get(title);
    if (bucket) bucket.push(row);
    else byGroup.set(title, [row]);
  }

  const items: BreedListItem[] = [];
  const stickyHeaderIndices: number[] = [];
  for (const [title, breeds] of byGroup) {
    stickyHeaderIndices.push(items.length);
    items.push({ type: 'header', key: `h:${title}`, title, count: breeds.length });
    for (const breed of breeds) items.push({ type: 'row', key: breed.id, breed });
  }
  return { items, stickyHeaderIndices, groupCount: byGroup.size };
}
