import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppProvider } from './presentation/context/AppContext'
import { WallPage } from './presentation/pages/WallPage'
import { CommitmentPage } from './presentation/pages/CommitmentPage'
import { UnsubscribePage } from './presentation/pages/UnsubscribePage'
import { AdminPage } from './presentation/pages/AdminPage'

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<WallPage />} />
          <Route path="/commit" element={<CommitmentPage />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

export default App
