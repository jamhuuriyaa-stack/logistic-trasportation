import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter as Router } from 'react-router-dom';
import RegisterPage from './RegisterPage';
import authService from '../services/authService';

vi.mock('../services/authService', () => ({
    default: {
        register: vi.fn(),
    },
}));

const renderWithRouter = (component) => {
    return render(<Router>{component}</Router>);
};

describe('RegisterPage', () => {
    beforeEach(() => {
        authService.register.mockClear();
    });

    it('should render the registration form', () => {
        renderWithRouter(<RegisterPage />);
        expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
    });

    it('should allow a user to register successfully', async () => {
        const user = userEvent.setup();
        authService.register.mockResolvedValue({ message: 'Registration successful!' });

        renderWithRouter(<RegisterPage />);

        await user.type(screen.getByLabelText(/full name/i), 'Test User');
        await user.type(screen.getByLabelText(/email/i), 'test@example.com');
        await user.type(screen.getByLabelText(/password/i), 'password123');
        await user.type(screen.getByLabelText(/phone number/i), '1234567890');
        await user.click(screen.getByRole('button', { name: /register/i }));

        await waitFor(() => {
            expect(authService.register).toHaveBeenCalledWith(
                'Test User',
                'test@example.com',
                'password123',
                '1234567890',
                'customer'
            );
            expect(screen.getByText(/registration successful/i)).toBeInTheDocument();
        });
    });

    it('should display an error message on failed registration', async () => {
        const user = userEvent.setup();
        const errorMessage = 'Email already in use';
        authService.register.mockRejectedValue({ response: { data: { message: errorMessage } } });

        renderWithRouter(<RegisterPage />);

        await user.type(screen.getByLabelText(/full name/i), 'Test User');
        await user.type(screen.getByLabelText(/email/i), 'test@example.com');
        await user.type(screen.getByLabelText(/password/i), 'password123');
        await user.type(screen.getByLabelText(/phone number/i), '1234567890');
        await user.click(screen.getByRole('button', { name: /register/i }));

        await waitFor(() => {
            expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });
    });
});
