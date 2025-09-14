import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Device, Call as TwilioCall } from '@twilio/voice-sdk'
import { voiceAPI } from '../services/api'
import { useAuth } from './AuthContext'
import { requestMicrophonePermission } from '../utils/permissions'

interface VoiceContextType {
  isReady: boolean
  isConnecting: boolean
  activeCall: TwilioCall | null
  incomingCall: TwilioCall | null
  makeCall: (phoneNumber: string) => Promise<void>
  answerCall: () => void
  rejectCall: () => void
  hangupCall: () => Promise<void>
  muteCall: () => void
  unmuteCall: () => void
  isMuted: boolean
  callStatus: string
  error: string | null
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined)

export const useVoice = () => {
  const context = useContext(VoiceContext)
  if (context === undefined) {
    throw new Error('useVoice must be used within a VoiceProvider')
  }
  return context
}

interface VoiceProviderProps {
  children: ReactNode
}

export const VoiceProvider: React.FC<VoiceProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const [device, setDevice] = useState<Device | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [activeCall, setActiveCall] = useState<TwilioCall | null>(null)
  const [incomingCall, setIncomingCall] = useState<TwilioCall | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)


  // Computed call status
  const callStatus = incomingCall ? 'incoming' : isConnecting ? 'connecting' : activeCall ? 'connected' : ''

  // Helper function to reset call state
  const resetCallState = () => {
    setActiveCall(null)
    setIncomingCall(null)
    setIsConnecting(false)
    setIsMuted(false)
  }

  // Initialize Twilio Device when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      initializeDevice()
    } else {
      cleanupDevice()
    }

    return () => {
      cleanupDevice()
    }
  }, [isAuthenticated])

  const initializeDevice = async () => {
    try {
      setError(null)

      // Request microphone permission
      const permissionResult = await requestMicrophonePermission()
      if (!permissionResult.granted) {
        setError('Microphone permission required for voice calls')
        setIsReady(false)
        return
      }

      // Get access token from backend
      const response = await voiceAPI.getToken()
      if (response.status === 503) {
        setError('Twilio not configured')
        setIsReady(false)
        return
      }

      const { token } = response.data

      // Create Twilio Device
      const newDevice = new Device(token, {
        logLevel: 'ERROR',
        allowIncomingWhileBusy: true,
      })

      // Simple device event listeners
      newDevice.on('registered', () => {
        setIsReady(true)
        setError(null)
      })

      newDevice.on('error', (error) => {
        setError(error?.message || 'Voice service error')
        setIsReady(false)
      })

      newDevice.on('incoming', (call) => {
        setIncomingCall(call)
        setupCallListeners(call)
      })

      newDevice.on('tokenWillExpire', async () => {
        try {
          const response = await voiceAPI.getToken()
          newDevice.updateToken(response.data.token)
        } catch (error: any) {
          setError('Failed to refresh token')
        }
      })

      await newDevice.register()
      setDevice(newDevice)
    } catch (error: any) {
      setError(error?.response?.data?.message || error?.message || 'Failed to initialize voice service')
      setIsReady(false)
    }
  }

  const cleanupDevice = () => {
    if (device) {
      device.destroy()
      setDevice(null)
    }
    setIsReady(false)
    resetCallState()
    setError(null)
  }

  const setupCallListeners = (call: TwilioCall) => {
    // Handle when call is accepted/answered (works for both incoming and outgoing)
    call.on('accept', () => {
      setActiveCall(call)
      setIncomingCall(null)
      setIsConnecting(false)
    })

    // Handle call disconnection
    call.on('disconnect', () => {
      resetCallState()
    })

    // Handle call cancellation (caller hangs up before answer)
    call.on('cancel', () => {
      setIncomingCall(null)
      setIsConnecting(false)
    })

    // Handle call rejection
    call.on('reject', () => {
      setIncomingCall(null)
      setIsConnecting(false)
    })

    // Handle call errors
    call.on('error', (error) => {
      setError(error.message || 'Call error')
      resetCallState()
    })

    // Handle ringing state for outbound calls
    call.on('ringing', () => {
      // Call is ringing on the other end
      console.log('📞 Call is ringing on the other end...')
    })

    // Add debug logging for all call events
    console.log('🔧 Setting up call listeners for call:', call.parameters)
  }

  const makeCall = async (phoneNumber: string) => {
    if (!device || !isReady) {
      throw new Error('Voice service not ready')
    }

    try {
      setIsConnecting(true)
      setError(null)

      console.log('📞 Initiating outbound call to:', phoneNumber)

      // Use Twilio Voice SDK to create the call connection
      const call = await device.connect({
        params: {
          To: phoneNumber,
          // The From parameter will be handled by the webhook based on Twilio configuration
          // But we can pass it explicitly if needed
        }
      })

      console.log('✅ Call object created, setting up listeners...')

      // Set up call event listeners for the outbound call
      setupCallListeners(call)

      // The call will be in connecting state until answered
      // When answered, the 'accept' event will fire and update the UI
    } catch (error: any) {
      console.error('❌ Failed to make call:', error)
      setError(error?.response?.data?.message || error?.message || 'Failed to make call')
      setIsConnecting(false)
      throw error
    }
  }

  const answerCall = () => {
    if (incomingCall) {
      incomingCall.accept()
    }
  }

  const rejectCall = () => {
    if (incomingCall) {
      incomingCall.reject()
    }
  }

  const hangupCall = async () => {
    try {
      // Disconnect Voice SDK call if active
      if (activeCall) {
        activeCall.disconnect()
      }

      // Reject incoming call if present
      if (incomingCall) {
        incomingCall.reject()
      }

      // Reset call state
      resetCallState()
    } catch (error: any) {
      console.error('Error hanging up call:', error)
      setError('Failed to hang up call')
    }
  }

  const muteCall = () => {
    if (activeCall) {
      activeCall.mute(true)
      setIsMuted(true)
    }
  }

  const unmuteCall = () => {
    if (activeCall) {
      activeCall.mute(false)
      setIsMuted(false)
    }
  }

  const value: VoiceContextType = {
    isReady,
    isConnecting,
    activeCall,
    incomingCall,
    makeCall,
    answerCall,
    rejectCall,
    hangupCall,
    muteCall,
    unmuteCall,
    isMuted,
    callStatus,
    error,
  }

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>
}
