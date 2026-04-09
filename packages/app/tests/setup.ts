import { vi } from 'vitest';

// Mock expo-router
vi.mock('expo-router', () => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  Tabs: Object.assign(
    ({ children }: { children: React.ReactNode }) => children,
    { Screen: ({ name }: { name: string }) => null },
  ),
}));

// Mock expo-font
vi.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
}));

// Mock expo-splash-screen
vi.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: vi.fn(),
  hideAsync: vi.fn(),
}));

// Mock @react-native-async-storage/async-storage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));
