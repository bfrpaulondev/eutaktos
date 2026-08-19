import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';

describe('Eutaktos app shell', () => {
  beforeEach(() => localStorage.clear());

  it('renders the main landmark and Smart Assign explanation', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText('Smart Assign')).toBeInTheDocument();
    expect(screen.getByText(/decisão continua humana/i)).toBeInTheDocument();
  });

  it('changes language per user preference', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Idioma'), { target: { value: 'en' } });
    expect(screen.getByText('Everything that needs your attention.')).toBeInTheDocument();
    expect(localStorage.getItem('eutaktos.preferences.v1')).toContain('"locale":"en"');
  });
});
