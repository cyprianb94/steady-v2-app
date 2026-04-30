import React from 'react';
import { beforeEach, vi } from 'vitest';

function createMockSupabaseClient() {
  return {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      setSession: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  };
}

function resetMockSupabaseClient(client: any) {
  client.auth.getSession.mockReset();
  client.auth.getSession.mockResolvedValue({ data: { session: null } });

  client.auth.onAuthStateChange.mockReset();
  client.auth.onAuthStateChange.mockReturnValue({
    data: {
      subscription: {
        unsubscribe: vi.fn(),
      },
    },
  });

  client.auth.setSession.mockReset();
  client.auth.setSession.mockResolvedValue({
    data: { session: null },
    error: null,
  });

  client.auth.signInWithOAuth.mockReset();
  client.auth.signInWithOAuth.mockResolvedValue({
    data: { url: 'https://supabase.test/oauth' },
    error: null,
  });

  client.auth.signOut.mockReset();
  client.auth.signOut.mockResolvedValue({ error: null });
}

function defaultCreateUrl(path = '/') {
  const normalizedPath = path.replace(/^\/+/, '');
  return normalizedPath ? `steady://${normalizedPath}` : 'steady://';
}

const appTestHarness = vi.hoisted(() => {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  };
  const useLocalSearchParams = vi.fn(() => ({}));
  const useIsFocused = vi.fn(() => true);
  const usePreventRemove = vi.fn();
  const asyncStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  };
  const linking = {
    createURL: vi.fn(defaultCreateUrl),
    useLinkingURL: vi.fn(() => null),
  };
  const queryParams = {
    getQueryParams: vi.fn(() => ({
      params: {},
      errorCode: null,
    })),
  };
  const webBrowser = {
    maybeCompleteAuthSession: vi.fn(),
    openAuthSessionAsync: vi.fn(),
  };
  const splashScreen = {
    preventAutoHideAsync: vi.fn(),
    hideAsync: vi.fn(),
  };
  const constants = {
    expoConfig: {},
    manifest: {},
    manifest2: {},
  };
  const supabaseClient = createMockSupabaseClient();
  const createSupabaseClient = vi.fn(() => supabaseClient);

  return {
    router,
    useLocalSearchParams,
    useIsFocused,
    usePreventRemove,
    asyncStorage,
    linking,
    queryParams,
    webBrowser,
    splashScreen,
    constants,
    supabaseClient,
    createSupabaseClient,
  };
});

vi.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) =>
    React.createElement('div', {
      'data-testid': 'redirect',
      'data-href': typeof href === 'string' ? href : JSON.stringify(href),
    }),
  router: appTestHarness.router,
  useRouter: () => appTestHarness.router,
  useLocalSearchParams: appTestHarness.useLocalSearchParams,
  Stack: Object.assign(
    ({ children }: { children: any }) => children,
    { Screen: ({ name: _name }: { name: string }) => null },
  ),
  Tabs: Object.assign(
    ({ children }: { children: any }) => children,
    { Screen: ({ name: _name }: { name: string }) => null },
  ),
}));

vi.mock('expo-font', () => ({
  useFonts: () => [true, null],
  isLoaded: () => true,
}));

vi.mock('expo-splash-screen', () => appTestHarness.splashScreen);

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, colors, end, locations, start, testID }: any) =>
    testID
      ? React.createElement(
          'div',
          {
            'data-testid': testID,
            'data-colors': Array.isArray(colors) ? colors.join('|') : undefined,
            'data-end': end ? `${end.x}|${end.y}` : undefined,
            'data-locations': Array.isArray(locations) ? locations.join('|') : undefined,
            'data-start': start ? `${start.x}|${start.y}` : undefined,
            'data-rn': 'LinearGradient',
          },
          children,
        )
      : React.createElement(React.Fragment, null, children),
}));

vi.mock('react-native-reanimated', () => {
  function resolveAnimatedStyle(style: any): any {
    if (typeof style?.value === 'number') return style.value;
    if (typeof style === 'function') return resolveAnimatedStyle(style());
    if (Array.isArray(style)) {
      return Object.assign({}, ...style.filter(Boolean).map(resolveAnimatedStyle));
    }
    if (!style || typeof style !== 'object') return style;
    return Object.fromEntries(
      Object.entries(style).map(([key, value]) => [key, resolveAnimatedStyle(value)]),
    );
  }

  function ReanimatedView({
    children,
    entering: _entering,
    exiting: _exiting,
    layout: _layout,
    style,
    ...props
  }: any) {
    const resolvedStyle = resolveAnimatedStyle(style);

    return React.createElement(
      'div',
      {
        'data-rn': 'Reanimated.View',
        style: resolvedStyle,
        ...props,
      },
      children,
    );
  }

  const animated = {
    View: ReanimatedView,
  };

  return {
    default: animated,
    Easing: {
      cubic: (value: number) => value,
      in: (fn: (value: number) => number) => fn,
      out: (fn: (value: number) => number) => fn,
    },
    interpolate: (value: number, inputRange: number[], outputRange: number[]) => {
      const [inputStart, inputEnd] = inputRange;
      const [outputStart, outputEnd] = outputRange;
      const ratio = inputEnd === inputStart ? 0 : (value - inputStart) / (inputEnd - inputStart);
      return outputStart + ((outputEnd - outputStart) * ratio);
    },
    ReduceMotion: {
      System: 'system',
    },
    runOnJS: (fn: (...args: any[]) => void) => fn,
    useAnimatedStyle: (factory: () => any) => factory(),
    useSharedValue: (value: any) => ({ value }),
    withTiming: (value: any, _config?: any, callback?: (finished: boolean) => void) => {
      callback?.(true);
      return value;
    },
  };
});

vi.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: {
    Light: 'light',
  },
  impactAsync: vi.fn().mockResolvedValue(undefined),
  selectionAsync: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => appTestHarness.useIsFocused(),
  usePreventRemove: appTestHarness.usePreventRemove,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: any }) =>
    React.createElement(React.Fragment, null, children),
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('react-native-gesture-handler', () => import('./mocks/react-native-gesture-handler'));

vi.mock('@gorhom/bottom-sheet', () => import('./mocks/gorhom-bottom-sheet'));

vi.mock('react-native-ui-datepicker', () => import('./mocks/react-native-ui-datepicker'));

vi.mock('react-native-svg', () => {
  function createSvgComponent(tagName: string) {
    return function SvgComponent({ children, testID, ...props }: any) {
      return React.createElement(
        tagName,
        {
          ...props,
          ...(testID ? { 'data-testid': testID } : {}),
        },
        children,
      );
    };
  }

  const Svg = createSvgComponent('svg');

  return {
    default: Svg,
    Svg,
    Defs: createSvgComponent('defs'),
    LinearGradient: createSvgComponent('linearGradient'),
    Path: createSvgComponent('path'),
    Stop: createSvgComponent('stop'),
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: appTestHarness.asyncStorage,
}));

vi.mock('expo-constants', () => ({
  default: appTestHarness.constants,
}));

vi.mock('expo-linking', () => appTestHarness.linking);

vi.mock('expo-auth-session/build/QueryParams', () => appTestHarness.queryParams);

vi.mock('expo-web-browser', () => appTestHarness.webBrowser);

vi.mock('@supabase/supabase-js', () => ({
  createClient: appTestHarness.createSupabaseClient,
}));

beforeEach(() => {
  appTestHarness.router.push.mockReset();
  appTestHarness.router.replace.mockReset();
  appTestHarness.router.back.mockReset();

  appTestHarness.useLocalSearchParams.mockReset();
  appTestHarness.useLocalSearchParams.mockReturnValue({});

  appTestHarness.useIsFocused.mockReset();
  appTestHarness.useIsFocused.mockReturnValue(true);
  appTestHarness.usePreventRemove.mockReset();

  appTestHarness.asyncStorage.getItem.mockReset();
  appTestHarness.asyncStorage.getItem.mockResolvedValue(null);
  appTestHarness.asyncStorage.setItem.mockReset();
  appTestHarness.asyncStorage.setItem.mockResolvedValue(undefined);
  appTestHarness.asyncStorage.removeItem.mockReset();
  appTestHarness.asyncStorage.removeItem.mockResolvedValue(undefined);
  appTestHarness.asyncStorage.clear.mockReset();
  appTestHarness.asyncStorage.clear.mockResolvedValue(undefined);

  appTestHarness.linking.createURL.mockReset();
  appTestHarness.linking.createURL.mockImplementation(defaultCreateUrl);
  appTestHarness.linking.useLinkingURL.mockReset();
  appTestHarness.linking.useLinkingURL.mockReturnValue(null);

  appTestHarness.queryParams.getQueryParams.mockReset();
  appTestHarness.queryParams.getQueryParams.mockReturnValue({
    params: {},
    errorCode: null,
  });

  appTestHarness.webBrowser.maybeCompleteAuthSession.mockReset();
  appTestHarness.webBrowser.openAuthSessionAsync.mockReset();
  appTestHarness.webBrowser.openAuthSessionAsync.mockResolvedValue({ type: 'dismiss' });

  appTestHarness.splashScreen.preventAutoHideAsync.mockReset();
  appTestHarness.splashScreen.hideAsync.mockReset();

  appTestHarness.constants.expoConfig = {};
  appTestHarness.constants.manifest = {};
  appTestHarness.constants.manifest2 = {};

  appTestHarness.createSupabaseClient.mockReset();
  appTestHarness.createSupabaseClient.mockReturnValue(appTestHarness.supabaseClient);
  resetMockSupabaseClient(appTestHarness.supabaseClient);

  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://supabase.test';
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.EXPO_PUBLIC_API_URL = 'https://api.steady.test';

  if (!globalThis.URL) {
    Reflect.set(globalThis, 'URL', URL);
  }
  if (!globalThis.URLSearchParams) {
    Reflect.set(globalThis, 'URLSearchParams', URLSearchParams);
  }
  Reflect.set(globalThis, '__DEV__', true);
});
