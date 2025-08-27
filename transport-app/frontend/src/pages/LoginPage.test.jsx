import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter as Router } from 'react-router-dom';
import LoginPage from './LoginPage';
import { AuthProvider } from '../context/AuthContext';
import authService from '../services/authService';

vi.mock('../services/authService', () => ({
    default: {
        login: vi.fn(),
        getCurrentUser: vi.fn(),
    },
}));

const renderWithRouterAndAuth = (component) => {
    return render(
        <Router>
            <AuthProvider>
                {component}
            </AuthProvider>
        </Router>
    );
};

describe('LoginPage', () => {
    beforeEach(() => {
        // Reset mocks before each test
        authService.login.mockClear();
        authService.getCurrentUser.mockClear();
    });

    it('should render the login form', () => {
        authService.getCurrentUser.mockReturnValue(null);
        renderWithRouterAndAuth(<LoginPage />);
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    });

    it('should allow a user to log in successfully', async () => {
        const user = userEvent.setup();
        authService.getCurrentUser.mockReturnValue(null);
        authService.login.mockResolvedValue({ token: 'fake-token' });

        renderWithRouterAndAuth(<LoginPage />);

        await user.type(screen.getByLabelText(/email/i), 'test@example.com');
        await user.type(screen.getByLabelText(/password/i), 'password123');
        await user.click(screen.getByRole('button', { name: /login/i }));

        await waitFor(() => {
            expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password123');
        });
    });

    it('should display an error message on failed login', async () => {
        const user = userEvent.setup();
        authService.getCurrentUser.mockReturnValue(null);
        const errorMessage = 'Invalid credentials';
        authService.login.mockRejectedValue({ response: { data: { message: errorMessage } } });

        renderWithRouterAndAuth(<LoginPage />);

        await user.type(screen.getByLabelText(/email/i), 'wrong@example.com');
        await user.type(screen.getByLabelText(/password/i), 'wrongpassword');
        await user.click(screen.getByRole('button', { name: /login/i }));

        await waitFor(() => {
            expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });
    });
});
