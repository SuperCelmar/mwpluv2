import '@testing-library/jest-dom';
import { server } from './mocks/server';
import { resetMockData } from './mocks/handlers';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll } from 'vitest';

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

// Reset handlers after each test and clean up DOM
afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetMockData();
});

// Close server after all tests
afterAll(() => {
  server.close();
});

