import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../components/layout/Sidebar';
import { TooltipProvider } from '../components/ui/Tooltip';

vi.mock('../lib/queries', () => ({
  useMeta: () => ({
    data: { demoMode: true, persistence: 'sqlite', environment: 'demo' },
  }),
  useExceptions: () => ({
    data: { counts: { open: 2, underReview: 1, resolved: 5 } },
  }),
}));

describe('sidebar navigation', () => {
  it('links to every workspace view and shows the open exception count', () => {
    render(
      <MemoryRouter>
        <TooltipProvider>
          <Sidebar open={false} onClose={() => undefined} />
        </TooltipProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Overview/ })).toHaveAttribute('href', '/overview');
    expect(screen.getByRole('link', { name: /Transactions/ })).toHaveAttribute(
      'href',
      '/transactions',
    );
    expect(screen.getByRole('link', { name: /Reconciliation/ })).toHaveAttribute(
      'href',
      '/reconciliation',
    );
    expect(screen.getByRole('link', { name: /Settlements/ })).toHaveAttribute(
      'href',
      '/settlements',
    );
    expect(screen.getByRole('link', { name: /Refunds/ })).toHaveAttribute('href', '/refunds');
    expect(screen.getByRole('link', { name: /Event log/ })).toHaveAttribute('href', '/events');
    expect(screen.getByRole('link', { name: /Demo lab/ })).toHaveAttribute('href', '/demo');
    expect(screen.getByRole('link', { name: /Settings/ })).toHaveAttribute('href', '/settings');

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Demo environment')).toBeInTheDocument();
    expect(screen.getByText(/no authentication/i)).toBeInTheDocument();
  });
});
