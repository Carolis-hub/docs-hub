import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { Login } from './pages/Login'
import { RequireAdmin } from './components/RequireAdmin'
import { BlockPage } from './pages/BlockPage'
import { Home } from './pages/Home'

/*
 * Páginas carregadas só quando a rota é aberta: o leitor que entra na Home não
 * baixa o editor, as telas de admin nem o assistente (o TipTap, por exemplo,
 * só vem com o primeiro artigo aberto).
 */
const ArticlePage = lazy(() =>
  import('./pages/ArticlePage').then((m) => ({ default: m.ArticlePage })),
)
const AssistentePage = lazy(() =>
  import('./pages/AssistentePage').then((m) => ({ default: m.AssistentePage })),
)
const CategoriasPage = lazy(() =>
  import('./pages/CategoriasPage').then((m) => ({ default: m.CategoriasPage })),
)
const SearchPage = lazy(() =>
  import('./pages/SearchPage').then((m) => ({ default: m.SearchPage })),
)
const SuggestionReview = lazy(() =>
  import('./pages/admin/SuggestionReview').then((m) => ({
    default: m.SuggestionReview,
  })),
)
const SuggestionsPage = lazy(() =>
  import('./pages/admin/SuggestionsPage').then((m) => ({
    default: m.SuggestionsPage,
  })),
)
const MetricsPage = lazy(() =>
  import('./pages/admin/MetricsPage').then((m) => ({ default: m.MetricsPage })),
)
const RevisaoPage = lazy(() =>
  import('./pages/admin/RevisaoPage').then((m) => ({ default: m.RevisaoPage })),
)
const SincronizacaoPage = lazy(() =>
  import('./pages/admin/SincronizacaoPage').then((m) => ({
    default: m.SincronizacaoPage,
  })),
)
const AssistenteUsoPage = lazy(() =>
  import('./pages/admin/AssistenteUsoPage').then((m) => ({
    default: m.AssistenteUsoPage,
  })),
)
const AuditoriaPage = lazy(() =>
  import('./pages/admin/AuditoriaPage').then((m) => ({
    default: m.AuditoriaPage,
  })),
)
const UnidadesPage = lazy(() =>
  import('./pages/admin/UnidadesPage').then((m) => ({
    default: m.UnidadesPage,
  })),
)
const UsersPage = lazy(() =>
  import('./pages/admin/UsersPage').then((m) => ({ default: m.UsersPage })),
)
const ConfiguracoesPage = lazy(() =>
  import('./pages/admin/ConfiguracoesPage').then((m) => ({
    default: m.ConfiguracoesPage,
  })),
)
const ArticleEditor = lazy(() =>
  import('./pages/admin/ArticleEditor').then((m) => ({
    default: m.ArticleEditor,
  })),
)

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <Layout>
              <Suspense fallback={<p className="text-suave">Carregando…</p>}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/busca" element={<SearchPage />} />
                  <Route path="/categorias" element={<CategoriasPage />} />
                  <Route path="/assistente" element={<AssistentePage />} />
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
                    path="/admin/revisao"
                    element={
                      <RequireAdmin>
                        <RevisaoPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/admin/sincronizacao"
                    element={
                      <RequireAdmin>
                        <SincronizacaoPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/admin/assistente"
                    element={
                      <RequireAdmin>
                        <AssistenteUsoPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/admin/auditoria"
                    element={
                      <RequireAdmin>
                        <AuditoriaPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/admin/unidades"
                    element={
                      <RequireAdmin>
                        <UnidadesPage />
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/admin/configuracoes"
                    element={
                      <RequireAdmin>
                        <ConfiguracoesPage />
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
              </Suspense>
            </Layout>
          </RequireAuth>
        }
      />
    </Routes>
  )
}

export default App
