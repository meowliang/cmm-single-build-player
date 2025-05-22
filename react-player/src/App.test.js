import { render, screen } from '@testing-library/react';
import App from './App';

test('renders player container', () => {
  render(<App />);
  const playerElement = screen.getByClassName('player-container');
  expect(playerElement).toBeInTheDocument();
});
