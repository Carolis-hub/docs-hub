import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Bloco } from './pages/Bloco'
import { Artigo } from './pages/Artigo'
import { AdminBlocos } from './pages/Admin/Blocos'
import { AdminArtigos } from './pages/Admin/Artigos'
import { AdminArtigoForm } from './pages/Admin/ArtigoForm'

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
                <Route path="/blocos/:blockId" element={<Bloco />} />
                <Route path="/artigos/:articleId" element={<Artigo />} />
                <Route path="/admin/blocos" element={<AdminBlocos />} />
                <Route path="/admin/artigos" element={<AdminArtigos />} />
                <Route
                  path="/admin/artigos/novo"
                  element={<AdminArtigoForm />}
                />
                <Route
                  path="/admin/artigos/:articleId/editar"
                  element={<AdminArtigoForm />}
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
