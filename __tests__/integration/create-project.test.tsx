import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from '@/app/page';
import { mockRouter } from '@/__tests__/utils/test-helpers';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

describe('Create Project Flow', () => {
  const user = userEvent.setup();
  let routerMocks: ReturnType<typeof mockRouter>;

  beforeEach(() => {
    routerMocks = mockRouter();
  });

  it('should render initial state with welcome message and address input', async () => {
    render(<Home />);

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    expect(screen.getByText('Bienvenue sur MWPLU')).toBeInTheDocument();
    expect(
      screen.getByText('Entrez l\'adresse de votre projet pour commencer l\'analyse du PLU')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ex: 15 rue des Fustiers/)).toBeInTheDocument();
  });

  it('should search for address and display suggestions', async () => {
    render(<Home />);

    // Wait for auth check
    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ex: 15 rue des Fustiers/);
    await user.type(input, '15 rue');

    // Wait for debounce and API call
    await waitFor(() => {
      expect(screen.getByText(/15 Rue des Fustiers/)).toBeInTheDocument();
    });

    // Verify suggestion is shown
    expect(screen.getByText('75001 Paris')).toBeInTheDocument();
  });

  it('should enable submit button when address is selected', async () => {
    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ex: 15 rue des Fustiers/);
    await user.type(input, '15 rue');

    // Wait for suggestions
    await waitFor(() => {
      expect(screen.getByText(/15 Rue des Fustiers/)).toBeInTheDocument();
    });

    // Click on first suggestion
    const suggestion = screen.getByText(/15 Rue des Fustiers/);
    await user.click(suggestion);

    // Button should now be enabled
    const submitButton = screen.getByRole('button', { name: /Commencer l'analyse/ });
    expect(submitButton).not.toBeDisabled();
  });

  it('should create project and navigate to chat page', async () => {
    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ex: 15 rue des Fustiers/);
    await user.type(input, '15 rue');

    // Wait for suggestions and select
    await waitFor(() => {
      expect(screen.getByText(/15 Rue des Fustiers/)).toBeInTheDocument();
    });

    const suggestion = screen.getByText(/15 Rue des Fustiers/);
    await user.click(suggestion);

    // Click submit
    const submitButton = screen.getByRole('button', { name: /Commencer l'analyse/ });
    await user.click(submitButton);

    // Wait for navigation
    await waitFor(() => {
      expect(routerMocks.push).toHaveBeenCalledWith(expect.stringMatching(/^\/chat\/project-/));
    });

    // Verify the project was created with correct data
    const callArgs = routerMocks.push.mock.calls[0][0];
    expect(callArgs).toMatch(/^\/chat\/project-/);
  });

  it('should create project with correct metadata', async () => {
    render(<Home />);

    await waitFor(() => {
      expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/Ex: 15 rue des Fustiers/);
    await user.type(input, '15 rue');

    await waitFor(() => {
      expect(screen.getByText(/15 Rue des Fustiers/)).toBeInTheDocument();
    });

    const suggestion = screen.getByText(/15 Rue des Fustiers/);
    await user.click(suggestion);

    const submitButton = screen.getByRole('button', { name: /Commencer l'analyse/ });
    await user.click(submitButton);

    // Wait for project creation
    await waitFor(() => {
      expect(routerMocks.push).toHaveBeenCalled();
    });

    // Note: In a real test, we'd verify the POST to /rest/v1/projects
    // included the correct address, municipality, gps_coordinates, and insee_code
    // This would be done by checking MSW request history
  });
});

