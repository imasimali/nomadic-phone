import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { CssBaseline, Box } from '@mui/material'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { VoiceProvider } from './contexts/VoiceContext'
import Login from './components/Auth/Login'
import MobileApp from './components/MobileApp'
import LoadingScreen from './components/Common/LoadingScreen'
import { StatusBarManager } from './utils/statusBar'

// Simple mobile-first theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#2c5aa0',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#f8f9fa',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 12,
          minHeight: 48,
          fontSize: '1rem',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            minHeight: 48,
            borderRadius: 12,
          },
        },
      },
    },
  },
})

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

// Public Route component (redirects to dashboard if already authenticated)
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

const AppContent: React.FC = () => {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <MobileApp />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

function App() {
  // Initialize StatusBar when app starts
  useEffect(() => {
    StatusBarManager.initialize()
  }, [])

  return (
    <Router>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <VoiceProvider>
            <Box
              sx={{
                minHeight: '100vh',
                backgroundColor: 'background.default',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <AppContent />
            </Box>
          </VoiceProvider>
        </AuthProvider>
      </ThemeProvider>
    </Router>
  )
}

export default App
