import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LandingPage } from '../pages/LandingPage';

describe('landing page', () => {
  it('presents the product, hero actions and workspace routes', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: /every payment, in a clearer light/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /four questions, answered independently/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /open dashboard/i })[0]).toHaveAttribute(
      'href',
      '/overview',
    );
    expect(
      screen
        .getAllByRole('link', { name: /demo lab/i })
        .some((link) => link.getAttribute('href') === '/demo'),
    ).toBe(true);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /ledgerlens overview/i })).toBeInTheDocument();
  });
});
