// Sample component test (CD-107): the placeholder shell renders its regions.
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/shared/test'
import App from '@/App.tsx'

describe('App (placeholder shell)', () => {
  it('renders the shell chrome regions', () => {
    const { getByRole, getByText } = renderWithProviders(<App />)

    expect(getByRole('banner')).toHaveTextContent('CyberDeck IDE')
    expect(getByRole('navigation', { name: 'Workspaces' })).toBeInTheDocument()
    expect(getByRole('main')).toBeInTheDocument()
    expect(getByText(/placeholder shell/i)).toBeInTheDocument()
  })
})
