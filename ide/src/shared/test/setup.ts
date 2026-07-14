// Vitest setup (CD-107): registers testing-library's jest-dom matchers
// (toBeInTheDocument, toHaveTextContent, …) on vitest's expect, and unmounts
// rendered components after each test (RTL cleanup — we don't use vitest globals,
// so auto-cleanup isn't registered for us).
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})
