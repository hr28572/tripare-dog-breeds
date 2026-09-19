import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { imageCache, triggerSync } from '@/hooks/useOfflineSync';
import { formatBytes, SettingsScreen } from '@/screens/SettingsScreen';
import { useSyncStore } from '@/stores/syncStore';

describe('formatBytes', () => {
  it('formats B, KB, MB', async () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(20 * 1024)).toBe('20 KB');
    expect(formatBytes(3.25 * 1024 * 1024)).toBe('3.3 MB');
  });
});

describe('<SettingsScreen />', () => {
  beforeEach(() => {
    (triggerSync as jest.Mock).mockClear();
    (imageCache.clear as jest.Mock).mockClear();
    (imageCache.stats as jest.Mock).mockReturnValue({ count: 12, bytes: 2 * 1024 * 1024, maxBytes: 100 * 1024 * 1024 });
    useSyncStore.setState({ hydrated: true, isOnline: true, isSyncing: false, lastStatus: 'success', lastSyncedAt: Date.now() - 120_000, lastAttemptAt: Date.now() - 120_000, breedCount: 283, imageCount: 7062, parseFailureCount: 0, lastError: null });
  });

  it('shows sync facts and cache usage, and syncs on demand', async () => {
    await render(<SettingsScreen />);
    expect(screen.getByText('283')).toBeTruthy();
    expect(screen.getByText('7062')).toBeTruthy();
    expect(screen.getByText('12 files · 2.0 MB')).toBeTruthy();
    expect(screen.getByText('100.0 MB')).toBeTruthy();
    await fireEvent.press(screen.getByText('Sync now'));
    expect(triggerSync).toHaveBeenCalledTimes(1);
  });

  it('disables sync while offline', async () => {
    useSyncStore.setState({ isOnline: false });
    await render(<SettingsScreen />);
    expect(screen.getByRole('button', { name: 'Sync now', disabled: true })).toBeTruthy();
    expect(screen.getByText(/You are offline/)).toBeTruthy();
  });

  it('clears the cache after confirmation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Clear')?.onPress?.();
    });
    await render(<SettingsScreen />);
    await fireEvent.press(screen.getByText('Clear image cache'));
    expect(alert).toHaveBeenCalled();
    expect(imageCache.clear).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });
});
