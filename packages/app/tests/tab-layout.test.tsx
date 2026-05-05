import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const tabScreens = vi.hoisted(() => [] as Array<{
  name?: string;
  options?: { href?: unknown; title?: string };
  listeners?: { tabPress?: () => void };
}>);

vi.mock('expo-router', () => ({
  Tabs: Object.assign(
    ({ children }: { children: any }) => <nav aria-label="Bottom tabs">{children}</nav>,
    {
      Screen: (props: {
        name?: string;
        options?: { href?: unknown; title?: string };
        listeners?: { tabPress?: () => void };
      }) => {
        tabScreens.push(props);
        if (props.options?.href === null) {
          return null;
        }

        return <span data-testid={`tab-${props.name}`}>{props.options?.title ?? props.name}</span>;
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

  it('renders only the normal bottom tabs while Coach and Steady AI are parked', () => {
    render(<TabLayout />);

    const screensByName = new Map(tabScreens.map(screen => [screen.name, screen]));

    expect(screen.getByTestId('tab-home').textContent).toBe('Home');
    expect(screen.getByTestId('tab-block').textContent).toBe('Block');
    expect(screen.getByTestId('tab-settings').textContent).toBe('Settings');
    expect(screen.queryByTestId('tab-coach')).toBeNull();
    expect(screen.queryByText('Coach')).toBeNull();
    expect(screen.queryByText('Steady AI')).toBeNull();
    expect(screensByName.get('coach')?.options?.href).toBeNull();
  });
});
