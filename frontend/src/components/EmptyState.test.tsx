import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from './EmptyState';

describe('<EmptyState />', () => {
  it('renders the title and description', () => {
    render(<EmptyState title="No games" description="Get started by adding one." />);
    expect(screen.getByRole('heading', { name: 'No games' })).toBeInTheDocument();
    expect(screen.getByText('Get started by adding one.')).toBeInTheDocument();
  });

  it('does not render an action button when none is provided', () => {
    render(<EmptyState title="t" description="d" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an action button and fires onClick when provided', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="t"
        description="d"
        action={{ label: 'Add game', onClick }}
      />
    );
    const btn = screen.getByRole('button', { name: 'Add game' });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
