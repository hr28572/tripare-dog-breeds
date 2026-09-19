import { fireEvent, render, screen } from '@testing-library/react-native';

import { describeSyncStatus, SyncBanner } from '@/components/SyncBanner';
import { triggerSync } from '@/hooks/useOfflineSync';
import { useSyncStore, type SyncStatusView } from '@/stores/syncStore';

const NOW = 1_700_000_000_000;

function view(overrides: Partial<SyncStatusView> = {}): SyncStatusView {
  return {
    hydrated: true,
    isOnline: true,
    isSyncing: false,
    lastStatus: 'success',
    lastSyncedAt: NOW - 5 * 60_000,
    lastAttemptAt: NOW - 5 * 60_000,
    lastError: null,
    breedCount: 283,
    imageCount: 7062,
    parseFailureCount: 0,
    hasCachedData: true,
    ...overrides,
  };
}

describe('describeSyncStatus', () => {
  it('prioritises syncing, then offline, then failure, then partial', async () => {
    expect(describeSyncStatus(view({ isSyncing: true, isOnline: false }), NOW).text).toBe('Syncing breeds…');
    expect(describeSyncStatus(view({ isOnline: false }), NOW)).toMatchObject({ text: 'Offline — showing cached data (synced 5 min ago)', tone: 'warning', canRetry: false });
    expect(describeSyncStatus(view({ isOnline: false, hasCachedData: false, breedCount: 0 }), NOW).tone).toBe('danger');
    expect(describeSyncStatus(view({ lastStatus: 'failed' }), NOW)).toMatchObject({ tone: 'danger', canRetry: true });
    expect(describeSyncStatus(view({ lastStatus: 'partial' }), NOW)).toMatchObject({ tone: 'warning', canRetry: true });
    expect(describeSyncStatus(view(), NOW)).toMatchObject({ text: 'Last synced 5 min ago', tone: 'muted' });
  });
});

describe('<SyncBanner />', () => {
  beforeEach(() => {
    (triggerSync as jest.Mock).mockClear();
    useSyncStore.setState({ hydrated: true, isOnline: true, isSyncing: false, lastStatus: 'success', lastSyncedAt: Date.now() - 60_000, breedCount: 283 });
  });

  it('renders nothing until hydrated', async () => {
    useSyncStore.setState({ hydrated: false });
    await render(<SyncBanner />);
    expect(screen.queryByText(/synced/i)).toBeNull();
  });

  it('shows the failure message and retries on press', async () => {
    useSyncStore.setState({ lastStatus: 'failed' });
    await render(<SyncBanner />);
    await fireEvent.press(screen.getByText(/Sync failed — showing cached data/));
    expect(triggerSync).toHaveBeenCalledTimes(1);
  });

  it('does not retry while offline', async () => {
    useSyncStore.setState({ isOnline: false });
    await render(<SyncBanner />);
    await fireEvent.press(screen.getByText(/Offline — showing cached data/));
    expect(triggerSync).not.toHaveBeenCalled();
  });
});
