import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeToggle } from './theme-toggle';

const setTheme = vi.fn();
let resolvedTheme = 'light';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme, setTheme }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => setTheme.mockClear());

  it('alterna do tema claro para o escuro', () => {
    resolvedTheme = 'light';
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Ativar tema escuro' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('alterna do tema escuro para o claro', () => {
    resolvedTheme = 'dark';
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Ativar tema claro' }));
    expect(setTheme).toHaveBeenCalledWith('light');
  });
});
