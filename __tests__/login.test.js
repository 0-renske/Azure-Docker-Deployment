import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from '../pages/login';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/router';

// Mock the router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock Firebase auth
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
}));

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  getDoc: jest.fn(() => Promise.resolve({ exists: () => true })),
  doc: jest.fn(),
}));

describe('Login Component', () => {
  const pushMock = jest.fn();

  beforeEach(() => {
    useRouter.mockReturnValue({ push: pushMock });
    signInWithEmailAndPassword.mockReset();
    pushMock.mockReset();
  });

  it('renders email and password inputs and login button', () => {
    render(<Login />);

    expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows alert when fields are empty', () => {
    window.alert = jest.fn(); // Mock alert
    render(<Login />);

    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    expect(window.alert).toHaveBeenCalledWith('Email and password required');
  });

  it('calls Firebase and redirects on successful login', async () => {
    signInWithEmailAndPassword.mockResolvedValue({
      user: { uid: '123' }
    });

    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText(/enter your email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), {
      target: { value: 'password123' }
    });

    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(expect.anything(), 'test@example.com', 'password123');
      expect(pushMock).toHaveBeenCalledWith('/Group6');
    });
  });

  it('shows error alert on login failure', async () => {
    window.alert = jest.fn(); // Mock alert
    signInWithEmailAndPassword.mockRejectedValue(new Error('Invalid credentials'));

    render(<Login />);

    fireEvent.change(screen.getByPlaceholderText(/enter your email/i), {
      target: { value: 'wrong@example.com' }
    });
    fireEvent.change(screen.getByPlaceholderText(/enter your password/i), {
      target: { value: 'wrongpass' }
    });

    fireEvent.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith('Failed to log in: Invalid credentials');
    });
  });
});
