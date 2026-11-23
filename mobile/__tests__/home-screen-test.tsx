import { render } from '@testing-library/react-native';

import HomeScreen from '../app/index';

describe('<HomeScreen />', () => {
  it('introduces Mistri as roadside assistance', async () => {
    const screen = await render(<HomeScreen />);

    expect(screen.getByText('Mistri')).toBeOnTheScreen();
    expect(screen.getByText('Roadside assistance, when you need it.')).toBeOnTheScreen();
  });
});
