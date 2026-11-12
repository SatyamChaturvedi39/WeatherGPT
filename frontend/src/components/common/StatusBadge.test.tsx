import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  it('renders healthy status with proper label', () => {
    render(<StatusBadge status="healthy" />);
    expect(screen.getByText('healthy')).toBeInTheDocument();
  });

  it('renders risk level badge correctly', () => {
    render(<StatusBadge status="High" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });
});
