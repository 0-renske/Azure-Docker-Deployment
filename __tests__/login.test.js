/**
 * @jest-environment jsdom
 */

import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';


jest.mock('../lib/firebase', () => ({
  auth: {},
  db: {},
}));

jest.mock('../config.js', () => ({
  config: {
    firebase: {
      apiKey: 'fake',
      authDomain: 'fake',
      projectId: 'fake',
    }
  },
  validateFirebaseConfig: () => true,
}));

import Login from '../pages/login';

describe('Login Component', () => {
  it('renders email and password inputs and login button', () => {
    render(<Login />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows alert when fields are empty', () => {
    jest.spyOn(window, 'alert').mockImplementation(() => {});
    render(<Login />);
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    expect(window.alert).toHaveBeenCalledWith('Email and password required');
  });
});
