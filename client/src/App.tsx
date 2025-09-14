import React, { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { CssBaseline, Box } from '@mui/material'
import { Provider as JotaiProvider } from 'jotai'
import { HelmetProvider } from 'react-helmet-async'
import { useAuth, useAuthInit } from './contexts/AuthContext'
import { useVoiceInit } from './contexts/VoiceContext'
import Login from './components/Auth/Login'
import MobileApp from './components/MobileApp'
import LoadingScreen from './components/Common/LoadingScreen'

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

// Initialization component to handle auth and voice setup
const AppInitializer: React.FC = () => {
  const checkAuth = useAuthInit()
  const { isAuthenticated, initializeDevice, cleanupDevice } = useVoiceInit()

  useEffect(() => {
    // Initialize auth on app start
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    // Handle voice initialization based on auth state
    if (isAuthenticated) {
      initializeDevice()
    } else {
      cleanupDevice()
    }
  }, [isAuthenticated, initializeDevice, cleanupDevice])

  return null
}

const AppContent: React.FC = () => {
  return (
    <>
      <AppInitializer />
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
    </>
  )
}

function App() {
  return (
    <HelmetProvider>
      <JotaiProvider>
        <Router>
          <ThemeProvider theme={theme}>
            <CssBaseline />
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
          </ThemeProvider>
        </Router>
      </JotaiProvider>
    </HelmetProvider>
  )
}

export default App
