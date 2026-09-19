// FlashList measures layout natively; under Jest render it as a FlatList so
// rows, empty states and refresh control behave like a normal list.
jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  const { FlatList } = require('react-native');
  return {
    ...jest.requireActual('@shopify/flash-list'),
    FlashList: React.forwardRef((props: object, ref: unknown) => React.createElement(FlatList, { ...props, ref })),
  };
});

jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));

// Native SQLite and the file-system cache are not available under Jest.
// Component tests exercise the UI against the stores; the data layer is
// covered by the better-sqlite3 integration tests.
jest.mock('@/db/client', () => ({ DB_NAME: 'test.db', sqlite: {}, db: {} }));

jest.mock('@/hooks/useOfflineSync', () => ({
  triggerSync: jest.fn(() => Promise.resolve()),
  isSyncStale: jest.fn(() => false),
  useOfflineSync: jest.fn(),
  useSyncStatus: jest.requireActual('@/stores/syncStore').useSyncStatus,
  imageCache: {
    ensureCached: jest.fn(async () => null),
    getLocalUri: jest.fn(() => null),
    prefetch: jest.fn(async () => ({ cached: 0, failed: 0 })),
    removeFiles: jest.fn(),
    evictIfNeeded: jest.fn(),
    clear: jest.fn(),
    stats: jest.fn(() => ({ count: 0, bytes: 0, maxBytes: 100 * 1024 * 1024 })),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const actual = jest.requireActual('react-native-safe-area-context');
  return { ...actual, useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }) };
});

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn(async () => ({ type: 'dismiss' })) }));
