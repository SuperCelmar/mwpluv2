import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '@/components/ChatInput';
import { ChatInputField } from '@/components/ChatInputField';

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

  it('does not trigger onSend when disabled', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(
      <ChatInput
        {...({
          onSend,
          disabled: true,
          disabledTooltip: 'Impossible de discuter avec ce document.',
        } as any)}
      />
    );

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    await user.type(textarea, 'Ma question ?');
    await user.keyboard('{Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });
});

describe('ChatInputField disabled behavior', () => {
  it('blocks submission and shows tooltip when disabled', async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();

    render(
      <ChatInputField
        onSend={onSend}
        disabled
        disabledTooltip="Impossible de discuter avec ce document."
      />
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Impossible de discuter avec ce document.');

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Puis-je construire ?');
    await user.click(button);

    expect(onSend).not.toHaveBeenCalled();
  });
});
