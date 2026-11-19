import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeToggle } from './theme-toggle';

const setTheme = vi.fn();
let resolvedTheme = 'light';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme, setTheme }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => setTheme.mockClear());

  it.each([
    ['light', 'dark'],
    ['dark', 'light'],
  ])('alterna do tema %s para o %s', (atual, proximo) => {
    resolvedTheme = atual;
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Alternar tema claro/escuro' }));
    expect(setTheme).toHaveBeenCalledWith(proximo);
  });
});
