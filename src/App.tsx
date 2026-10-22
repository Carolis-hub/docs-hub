import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { Login } from './pages/Login'
import { RequireAdmin } from './components/RequireAdmin'
import { ArticlePage } from './pages/ArticlePage'
import { BlockPage } from './pages/BlockPage'
import { Home } from './pages/Home'
import { SearchPage } from './pages/SearchPage'
import { SuggestionReview } from './pages/admin/SuggestionReview'
import { SuggestionsPage } from './pages/admin/SuggestionsPage'
import { MetricsPage } from './pages/admin/MetricsPage'
import { UsersPage } from './pages/admin/UsersPage'
import { ArticleEditor } from './pages/admin/ArticleEditor'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/busca" element={<SearchPage />} />
                <Route path="/b/:blockId" element={<BlockPage />} />
                <Route path="/a/:articleId" element={<ArticlePage />} />
                <Route
                  path="/admin/sugestoes"
                  element={
                    <RequireAdmin>
                      <SuggestionsPage />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/admin/sugestoes/:articleId/:suggestionId"
                  element={
                    <RequireAdmin>
                      <SuggestionReview />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/admin/metricas"
                  element={
                    <RequireAdmin>
                      <MetricsPage />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/admin/usuarios"
                  element={
                    <RequireAdmin>
                      <UsersPage />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/admin/artigos/novo"
                  element={
                    <RequireAdmin>
                      <ArticleEditor />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/admin/artigos/:articleId/editar"
                  element={
                    <RequireAdmin>
                      <ArticleEditor />
                    </RequireAdmin>
                  }
                />
              </Routes>
            </Layout>
          </RequireAuth>
        }
      />
    </Routes>
  )
}

export default App
