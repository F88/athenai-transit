import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BaseBadge } from './base-badge';

describe('BaseBadge', () => {
  it('applies borderColor without bgColor', () => {
    render(
      <BaseBadge
        label="Example"
        size="sm"
        infoLevel="normal"
        showBorder={true}
        borderColor="#ff0000"
      />,
    );

    expect(screen.getByText('Example')).toHaveStyle({ borderColor: 'rgb(255, 0, 0)' });
  });
});
