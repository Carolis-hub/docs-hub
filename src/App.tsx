import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { RequireAdmin } from './components/RequireAdmin'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Bloco } from './pages/Bloco'
import { Artigo } from './pages/Artigo'
import { AdminBlocos } from './pages/Admin/Blocos'
import { AdminArtigos } from './pages/Admin/Artigos'
import { AdminArtigoForm } from './pages/Admin/ArtigoForm'
import { AdminUsuarios } from './pages/Admin/Usuarios'

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
                <Route
                  path="/admin/blocos"
                  element={
                    <RequireAdmin>
                      <AdminBlocos />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/admin/artigos"
                  element={
                    <RequireAdmin>
                      <AdminArtigos />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/admin/artigos/novo"
                  element={
                    <RequireAdmin>
                      <AdminArtigoForm />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/admin/artigos/:articleId/editar"
                  element={
                    <RequireAdmin>
                      <AdminArtigoForm />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="/admin/usuarios"
                  element={
                    <RequireAdmin>
                      <AdminUsuarios />
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
