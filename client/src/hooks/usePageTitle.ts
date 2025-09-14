import { useEffect } from 'react'

/**
 * Hook to set the document title dynamically
 * @param title - The page title (will be prefixed with "Nomadic Phone" if not "Dashboard")
 */
export const usePageTitle = (title: string) => {
  useEffect(() => {
    const fullTitle = title === 'Dashboard' ? 'Nomadic Phone' : `${title} - Nomadic Phone`
    document.title = fullTitle

    // Cleanup function to reset title when component unmounts
    return () => {
      document.title = 'Nomadic Phone'
    }
  }, [title])
}

export default usePageTitle
