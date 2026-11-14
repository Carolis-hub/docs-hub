import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { Login } from './pages/Login'
import { RequireAdmin } from './components/RequireAdmin'
import { RequirePermissao } from './components/RequirePermissao'
import { BlockPage } from './pages/BlockPage'
import { Home } from './pages/Home'
import { Carregando } from './components/Carregando'

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
const UsuarioPage = lazy(() =>
  import('./pages/admin/UsuarioPage').then((m) => ({ default: m.UsuarioPage })),
)
const UnidadePage = lazy(() =>
  import('./pages/UnidadePage').then((m) => ({ default: m.UnidadePage })),
)
const PreferenciasPage = lazy(() =>
  import('./pages/PreferenciasPage').then((m) => ({
    default: m.PreferenciasPage,
  })),
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
              <Suspense fallback={<Carregando />}>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <RequirePermissao id="manual">
                        <Home />
                      </RequirePermissao>
                    }
                  />
                  <Route
                    path="/u/:unidadeId"
                    element={
                      <RequirePermissao id="manual">
                        <UnidadePage />
                      </RequirePermissao>
                    }
                  />
                  <Route
                    path="/busca"
                    element={
                      <RequirePermissao id="manual">
                        <SearchPage />
                      </RequirePermissao>
                    }
                  />
                  <Route
                    path="/categorias"
                    element={
                      <RequirePermissao id="manual">
                        <CategoriasPage />
                      </RequirePermissao>
                    }
                  />
                  <Route
                    path="/assistente"
                    element={
                      <RequirePermissao id="busca">
                        <AssistentePage />
                      </RequirePermissao>
                    }
                  />
                  <Route path="/preferencias" element={<PreferenciasPage />} />
                  <Route
                    path="/b/:blockId"
                    element={
                      <RequirePermissao id="manual">
                        <BlockPage />
                      </RequirePermissao>
                    }
                  />
                  <Route
                    path="/a/:articleId"
                    element={
                      <RequirePermissao id="manual">
                        <ArticlePage />
                      </RequirePermissao>
                    }
                  />
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
                        <RequirePermissao id="metricas">
                          <MetricsPage />
                        </RequirePermissao>
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/admin/revisao"
                    element={
                      <RequireAdmin>
                        <RequirePermissao id="revisao">
                          <RevisaoPage />
                        </RequirePermissao>
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/admin/sincronizacao"
                    element={
                      <RequireAdmin>
                        <RequirePermissao id="sincronizacao">
                          <SincronizacaoPage />
                        </RequirePermissao>
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/admin/assistente"
                    element={
                      <RequireAdmin>
                        <RequirePermissao id="usoIA">
                          <AssistenteUsoPage />
                        </RequirePermissao>
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/admin/auditoria"
                    element={
                      <RequireAdmin>
                        <RequirePermissao id="auditoria">
                          <AuditoriaPage />
                        </RequirePermissao>
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
                  {/* A lista de usuários fica na tela Configurações. */}
                  <Route
                    path="/admin/usuarios"
                    element={<Navigate to="/admin/configuracoes" replace />}
                  />
                  <Route
                    path="/admin/usuarios/novo"
                    element={
                      <RequireAdmin>
                        <RequirePermissao id="usuarios">
                          <UsuarioPage />
                        </RequirePermissao>
                      </RequireAdmin>
                    }
                  />
                  <Route
                    path="/admin/usuarios/:uid/editar"
                    element={
                      <RequireAdmin>
                        <RequirePermissao id="usuarios">
                          <UsuarioPage />
                        </RequirePermissao>
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
