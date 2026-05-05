import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { STEADY_AI_FREEZE_MESSAGE, STEADY_AI_FREEZE_TITLE } from '@steady/types';
import CoachTab from '../app/(tabs)/coach';

describe('CoachTab Steady AI freeze', () => {
  it('renders a paused state instead of chat, input, or navigation CTAs', () => {
    render(<CoachTab />);

    expect(screen.getByText(STEADY_AI_FREEZE_TITLE)).toBeTruthy();
    expect(screen.getByText(STEADY_AI_FREEZE_MESSAGE)).toBeTruthy();
    expect(screen.queryByText(/Chat with Steady/i)).toBeNull();
    expect(screen.queryByText(/Sign in to chat/i)).toBeNull();
    expect(screen.queryByText(/Go to settings/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/Message Steady/i)).toBeNull();
  });
});
