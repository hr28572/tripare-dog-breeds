import { cleanup, render, screen } from '@testing-library/react-native';

import { CachedImage, OFFLINE_PLACEHOLDER_LABEL } from '@/components/CachedImage';
import { useSyncStore } from '@/stores/syncStore';

const remote = { id: 'img:medium', url: 'https://img/m', variant: 'medium' as const, localUri: null, cachedLocally: false };
const local = { ...remote, localUri: 'file:///cache/img.img', cachedLocally: true };

describe('<CachedImage />', () => {
  afterEach(async () => {
    await cleanup();
    useSyncStore.setState({ isOnline: true });
  });

  it('renders the image when online even if not cached', async () => {
    await render(<CachedImage source={remote} />);
    expect(screen.queryByTestId('image-placeholder')).toBeNull();
  });

  it('shows the offline placeholder for an uncached image with no network', async () => {
    useSyncStore.setState({ isOnline: false });
    await render(<CachedImage source={remote} />);
    expect(screen.getByTestId('image-placeholder')).toBeTruthy();
    expect(screen.getByText(OFFLINE_PLACEHOLDER_LABEL)).toBeTruthy();
  });

  it('still renders a locally cached image offline', async () => {
    useSyncStore.setState({ isOnline: false });
    await render(<CachedImage source={local} />);
    expect(screen.queryByTestId('image-placeholder')).toBeNull();
  });

  it('shows a placeholder when there is no source at all', async () => {
    await render(<CachedImage source={null} compactPlaceholder />);
    expect(screen.getByTestId('image-placeholder')).toBeTruthy();
    expect(screen.queryByText(OFFLINE_PLACEHOLDER_LABEL)).toBeNull();
  });
});
