import { render, screen } from '@testing-library/react';
import React from 'react';


describe('Sample test', () => {
  it('displays a heading', () => {
    render(<h1>Hello from test</h1>);
    expect(screen.getByText('Hello from test')).toBeInTheDocument();
  });
});
