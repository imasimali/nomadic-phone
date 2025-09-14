import { atom, useAtomValue, useSetAtom } from 'jotai'
import { authAPI, User } from '../services/api'

// Auth atoms
export const userAtom = atom<User | null>(null)
export const isLoadingAtom = atom<boolean>(true)

// Derived atom for authentication status
export const isAuthenticatedAtom = atom((get) => !!get(userAtom))

// Auth actions
const loginAction = atom(
  null,
  async (get, set, password: string) => {
    try {
      const response = await authAPI.login(password)
      const { user: userData, tokens } = response.data

      localStorage.setItem('accessToken', tokens.accessToken)
      localStorage.setItem('refreshToken', tokens.refreshToken)
      set(userAtom, userData)
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Login failed')
    }
  }
)

const logoutAction = atom(
  null,
  (_get, set) => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    set(userAtom, null)

    // Call logout endpoint to invalidate token on server (optional)
    authAPI.logout().catch(() => {
      // Ignore errors on logout
    })
  }
)

const checkAuthAction = atom(
  null,
  async (_get, set) => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      try {
        const response = await authAPI.getProfile()
        set(userAtom, response.data.user)
      } catch (error) {
        // Token is invalid, remove it
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
      }
    }
    set(isLoadingAtom, false)
  }
)

// Custom hook to replace useAuth
export const useAuth = () => {
  const user = useAtomValue(userAtom)
  const isLoading = useAtomValue(isLoadingAtom)
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)
  const login = useSetAtom(loginAction)
  const logout = useSetAtom(logoutAction)

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
  }
}

// Hook for auth initialization
export const useAuthInit = () => {
  const checkAuth = useSetAtom(checkAuthAction)
  return checkAuth
}
