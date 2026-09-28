import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AuthProvider } from './hooks/useAuth.tsx'
import { ThemeProvider } from './hooks/useTheme.tsx'
import { UserProfileProvider } from './hooks/useUserProfile.tsx'
import { SearchIndexProvider } from './hooks/useSearchIndex.tsx'
import './index.css'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Elemento #root não encontrado em index.html')
}

createRoot(rootElement).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <UserProfileProvider>
          <SearchIndexProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </SearchIndexProvider>
        </UserProfileProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
