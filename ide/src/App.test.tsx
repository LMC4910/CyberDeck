// Sample component test (CD-107, CD-136): the shell renders its regions and boots.
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/shared/test'
import App from '@/App.tsx'

describe('App (shell)', () => {
  it('renders the shell chrome regions', () => {
    const { getByRole, getByTestId } = renderWithProviders(<App />)

    expect(getByRole('banner')).toHaveTextContent('CyberDeck IDE')
    expect(getByRole('navigation', { name: 'Workspaces' })).toBeInTheDocument()
    expect(getByRole('main')).toBeInTheDocument()
    expect(getByTestId('shell')).toHaveAttribute('data-boot') // booting or interactive
  })
})
