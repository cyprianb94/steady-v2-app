import React from 'react';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tabScreens = vi.hoisted(() => [] as Array<{ name?: string; listeners?: { tabPress?: () => void } }>);

vi.mock('expo-router', () => ({
  Tabs: Object.assign(
    ({ children }: { children: any }) => children,
    {
      Screen: (props: { name?: string; listeners?: { tabPress?: () => void } }) => {
        tabScreens.push(props);
        return null;
      },
    },
  ),
}));

import TabLayout from '../app/(tabs)/_layout';

describe('TabLayout haptics', () => {
  beforeEach(() => {
    tabScreens.length = 0;
  });

  it('does not attach haptics to high-frequency tab navigation', () => {
    render(<TabLayout />);

    const screensByName = new Map(tabScreens.map(screen => [screen.name, screen]));

    expect(screensByName.get('home')?.listeners?.tabPress).toBeUndefined();
    expect(screensByName.get('block')?.listeners?.tabPress).toBeUndefined();
    expect(screensByName.get('settings')?.listeners?.tabPress).toBeUndefined();
  });
});
