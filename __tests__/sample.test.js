import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';

function Greeting() {
  const [name, setName] = useState('');
  const [greet, setGreet] = useState('');

  function handleClick() {
    setGreet(`Hello, ${name || 'Guest'}!`);
  }

  return (
    <div>
      <input
        placeholder="Enter your name"
        value={name}
        onChange={e => setName(e.target.value)}
        data-testid="name-input"
      />
      <button onClick={handleClick}>Greet</button>
      {greet && <p>{greet}</p>}
    </div>
  );
}

describe('Greeting component', () => {
  it('renders input and button, displays greeting on click', () => {
    render(<Greeting />);
    
    const input = screen.getByTestId('name-input');
    const button = screen.getByText('Greet');

    
    expect(screen.queryByText(/Hello/)).toBeNull();

    
    fireEvent.change(input, { target: { value: 'Alice' } });
    expect(input.value).toBe('Alice');

    
    fireEvent.click(button);

    
    expect(screen.getByText('Hello, Alice!')).toBeInTheDocument();
  });

  it('displays default greeting if no name entered', () => {
    render(<Greeting />);
    
    const button = screen.getByText('Greet');
    fireEvent.click(button);
    
    expect(screen.getByText('Hello, Guest!')).toBeInTheDocument();
  });
});
