/**
 * Utility functions for handling device permissions
 */

export interface PermissionStatus {
  granted: boolean
  error?: string
}

/**
 * Request microphone permission for voice calls
 */
export const requestMicrophonePermission = async (): Promise<PermissionStatus> => {
  try {
    // Check if we're in a browser environment
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })

        // Stop the stream immediately as we just needed to check permission
        stream.getTracks().forEach((track) => track.stop())

        return { granted: true }
      } catch (error: any) {
        console.error('Microphone permission denied:', error)

        // Handle specific error types
        if (error.name === 'NotAllowedError') {
          return {
            granted: false,
            error: 'Microphone permission denied. Please allow microphone access in your browser settings.',
          }
        } else if (error.name === 'NotFoundError') {
          return {
            granted: false,
            error: 'No microphone found on this device.',
          }
        } else if (error.name === 'NotSupportedError') {
          return {
            granted: false,
            error: 'Microphone access is not supported in this browser.',
          }
        } else {
          return {
            granted: false,
            error: `Failed to access microphone: ${error.message}`,
          }
        }
      }
    } else {
      return {
        granted: false,
        error: 'Media devices not supported in this environment.',
      }
    }
  } catch (error: any) {
    console.error('Error requesting microphone permission:', error)
    return {
      granted: false,
      error: `Permission request failed: ${error.message}`,
    }
  }
}

/**
 * Check if microphone permission is already granted
 */
export const checkMicrophonePermission = async (): Promise<PermissionStatus> => {
  try {
    // Check if we're in a browser environment with permissions API
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      try {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        return { granted: permission.state === 'granted' }
      } catch (error) {
        // Fallback to getUserMedia check if permissions API fails
        console.warn('Permissions API not available, falling back to getUserMedia check')
      }
    }

    // Fallback: try to access microphone to check permission
    return await requestMicrophonePermission()
  } catch (error: any) {
    console.error('Error checking microphone permission:', error)
    return {
      granted: false,
      error: `Permission check failed: ${error.message}`,
    }
  }
}

/**
 * Get user-friendly error message for common permission issues
 */
export const getPermissionErrorMessage = (error: string): string => {
  if (error.includes('NotAllowedError') || error.includes('permission denied')) {
    return 'Please allow microphone access in your device settings to make voice calls.'
  } else if (error.includes('NotFoundError')) {
    return 'No microphone was found on your device.'
  } else if (error.includes('NotSupportedError')) {
    return 'Voice calls are not supported in this browser. Please try using Chrome, Safari, or Firefox.'
  } else if (error.includes('31402')) {
    return 'Voice call setup failed. Please check your microphone permissions and try again.'
  } else {
    return 'Unable to access microphone. Please check your device settings and try again.'
  }
}
