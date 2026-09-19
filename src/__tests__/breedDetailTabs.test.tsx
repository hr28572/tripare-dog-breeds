import { fireEvent, render, screen } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';

import { attributionText, GalleryTab } from '@/screens/breed-detail/GalleryTab';
import { OverviewTab } from '@/screens/breed-detail/OverviewTab';
import { TraitsTab } from '@/screens/breed-detail/TraitsTab';

import { makeBreed, makeImage } from './helpers/factories';

describe('<OverviewTab />', () => {
  it('renders the facts that exist and opens sources in the browser', async () => {
    await render(<OverviewTab breed={makeBreed()} groupName="Toy" />);
    expect(screen.getByText('A small, playful breed.')).toBeTruthy();
    expect(screen.getByText('Also known as Monkey Terrier, Affen')).toBeTruthy();
    expect(screen.getByText('Toy')).toBeTruthy();
    expect(screen.getByText('14–16 years')).toBeTruthy();
    expect(screen.getAllByText('4–6 kg')).toHaveLength(2);
    expect(screen.getByText('Germany, Central Europe, 17th century')).toBeTruthy();
    expect(screen.getByText('Short length, wire coat')).toBeTruthy();
    expect(screen.getByText('AKC')).toBeTruthy();

    await fireEvent.press(screen.getByText('Breed standard'));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith('https://example.com/std');
  });

  it('omits rows with no data', async () => {
    await render(<OverviewTab breed={makeBreed({ maleHeightMin: null, maleHeightMax: null, otherNames: [], sources: [] })} groupName={null} />);
    expect(screen.queryByText('Height (male)')).toBeNull();
    expect(screen.queryByText(/Also known as/)).toBeNull();
    expect(screen.queryByText('Sources')).toBeNull();
  });
});

describe('<TraitsTab />', () => {
  it('renders one gauge per trait with accessible values, plus temperament', async () => {
    await render(<TraitsTab breed={makeBreed()} />);
    expect(screen.getByLabelText('Energy: 3/5')).toBeTruthy();
    expect(screen.getByLabelText('Daily exercise: 30 min/day')).toBeTruthy();
    expect(screen.getAllByRole('progressbar')).toHaveLength(11);
    expect(screen.getByText('playful')).toBeTruthy();
  });

  it('explains when no scores exist', async () => {
    const noTraits = makeBreed({
      energy: null, barking: null, drooling: null, grooming: null, shedding: null, trainability: null,
      goodWithDogs: null, goodWithChildren: null, goodWithStrangers: null, apartmentFriendly: null, exerciseMinutes: null,
      temperament: [],
    });
    await render(<TraitsTab breed={noTraits} />);
    expect(screen.getByText(/No trait scores are available/)).toBeTruthy();
    expect(screen.getByLabelText('Energy: No data')).toBeTruthy();
  });
});

describe('<GalleryTab />', () => {
  it('pages through medium images with attribution and opens the viewer on press', async () => {
    const images = [
      makeImage(),
      makeImage({ id: 'img1:large', variant: 'large', url: 'https://img/large' }),
      makeImage({ id: 'img1:thumb', variant: 'thumb', url: 'https://img/thumb' }),
      makeImage({ id: 'img2:medium', imageId: 'img2', position: 1, url: 'https://img/m2', author: 'Bob', license: 'CC0' }),
    ];
    await render(<GalleryTab images={images} />);
    // FlatList virtualises: only the first page is mounted before layout, but the pager knows both.
    expect(screen.getByLabelText('Photo 1 of 2')).toBeTruthy();
    expect(screen.getByText('© Ada · CC BY 2.0 · wikimedia commons')).toBeTruthy();
    expect(screen.getByText('1 / 2')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Photo by Ada, opens full screen'));
    expect(screen.getByLabelText('Breed photo by Ada')).toBeTruthy();
  });

  it('caps the pager at nine images and formats attribution', async () => {
    const images = Array.from({ length: 12 }, (_, i) =>
      makeImage({ id: `i${i}:medium`, imageId: `i${i}`, position: i, url: `https://img/${i}` }),
    );
    await render(<GalleryTab images={images} />);
    expect(screen.getByText('1 / 9')).toBeTruthy();
    expect(attributionText(makeImage({ author: null, license: null, source: null }))).toBe('');
  });

  it('shows an empty message with no images', async () => {
    await render(<GalleryTab images={[]} />);
    expect(screen.getByText(/No photos available/)).toBeTruthy();
  });
});
