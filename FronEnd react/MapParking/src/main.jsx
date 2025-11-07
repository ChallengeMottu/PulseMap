import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import MapaPatio from './mapaPatio.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MapaPatio />
  </StrictMode>,
)
