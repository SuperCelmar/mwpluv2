import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatInput } from '@/components/ChatInput';

describe('ChatInput disabled tooltip', () => {
  it('shows tooltip text when disabledTooltip provided', () => {
    render(
      <ChatInput
        {...({
          onSend: vi.fn(),
          disabled: true,
          disabledTooltip: 'Impossible de discuter avec ce document.',
        } as any)}
      />
    );

    const sendButton = screen.getByRole('button');
    expect(sendButton).toHaveAttribute(
      'title',
      'Impossible de discuter avec ce document.'
    );
  });
});
