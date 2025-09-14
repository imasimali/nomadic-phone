import { atom, useAtomValue, useSetAtom } from 'jotai'
import { Device, Call as TwilioCall } from '@twilio/voice-sdk'
import { voiceAPI } from '../services/api'
import { isAuthenticatedAtom } from './AuthContext'
import { requestMicrophonePermission } from '../utils/permissions'

// Voice atoms
export const deviceAtom = atom<Device | null>(null)
export const isReadyAtom = atom<boolean>(false)
export const isConnectingAtom = atom<boolean>(false)
export const activeCallAtom = atom<TwilioCall | null>(null)
export const incomingCallAtom = atom<TwilioCall | null>(null)
export const isMutedAtom = atom<boolean>(false)
export const voiceErrorAtom = atom<string | null>(null)

// Derived atom for call status
export const callStatusAtom = atom((get) => {
  const incomingCall = get(incomingCallAtom)
  const isConnecting = get(isConnectingAtom)
  const activeCall = get(activeCallAtom)

  return incomingCall ? 'incoming' : isConnecting ? 'connecting' : activeCall ? 'connected' : ''
})

// Setup call listeners function
const setupCallListeners = (call: TwilioCall, set: any) => {
  // Handle when call is accepted/answered (works for both incoming and outgoing)
  call.on('accept', () => {
    set(activeCallAtom, call)
    set(incomingCallAtom, null)
    set(isConnectingAtom, false)
  })

  // Handle call disconnection
  call.on('disconnect', () => {
    set(activeCallAtom, null)
    set(incomingCallAtom, null)
    set(isConnectingAtom, false)
    set(isMutedAtom, false)
  })

  // Handle call cancellation (caller hangs up before answer)
  call.on('cancel', () => {
    set(incomingCallAtom, null)
    set(isConnectingAtom, false)
  })

  // Handle call rejection
  call.on('reject', () => {
    set(incomingCallAtom, null)
    set(isConnectingAtom, false)
  })

  // Handle call errors
  call.on('error', (error: any) => {
    set(voiceErrorAtom, error.message || 'Call error')
    set(activeCallAtom, null)
    set(incomingCallAtom, null)
    set(isConnectingAtom, false)
    set(isMutedAtom, false)
  })

  // Handle ringing state for outbound calls
  call.on('ringing', () => {
    // Call is ringing on the other end
    console.log('📞 Call is ringing on the other end...')
  })

  // Add debug logging for all call events
  console.log('🔧 Setting up call listeners for call:', call.parameters)
}

// Initialize device action
const initializeDeviceAction = atom(null, async (_get, set) => {
  try {
    set(voiceErrorAtom, null)

    // Request microphone permission
    const permissionResult = await requestMicrophonePermission()
    if (!permissionResult.granted) {
      set(voiceErrorAtom, 'Microphone permission required for voice calls')
      set(isReadyAtom, false)
      return
    }

    // Get access token from backend
    const response = await voiceAPI.getToken()
    if (response.status === 503) {
      set(voiceErrorAtom, 'Twilio not configured')
      set(isReadyAtom, false)
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
      set(isReadyAtom, true)
      set(voiceErrorAtom, null)
    })

    newDevice.on('error', (error) => {
      set(voiceErrorAtom, error?.message || 'Voice service error')
      set(isReadyAtom, false)
    })

    newDevice.on('incoming', (call) => {
      set(incomingCallAtom, call)
      setupCallListeners(call, set)
    })

    newDevice.on('tokenWillExpire', async () => {
      try {
        const response = await voiceAPI.getToken()
        newDevice.updateToken(response.data.token)
      } catch (error: any) {
        set(voiceErrorAtom, 'Failed to refresh token')
      }
    })

    await newDevice.register()
    set(deviceAtom, newDevice)
  } catch (error: any) {
    set(voiceErrorAtom, error?.response?.data?.message || error?.message || 'Failed to initialize voice service')
    set(isReadyAtom, false)
  }
})

// Cleanup device action
const cleanupDeviceAction = atom(null, (get, set) => {
  const device = get(deviceAtom)
  if (device) {
    device.destroy()
    set(deviceAtom, null)
  }
  set(isReadyAtom, false)
  set(activeCallAtom, null)
  set(incomingCallAtom, null)
  set(isConnectingAtom, false)
  set(isMutedAtom, false)
  set(voiceErrorAtom, null)
})

// Make call action
const makeCallAction = atom(null, async (get, set, phoneNumber: string) => {
  const device = get(deviceAtom)
  const isReady = get(isReadyAtom)

  if (!device || !isReady) {
    throw new Error('Voice service not ready')
  }

  try {
    set(isConnectingAtom, true)
    set(voiceErrorAtom, null)

    console.log('📞 Initiating outbound call to:', phoneNumber)

    // Use Twilio Voice SDK to create the call connection
    const call = await device.connect({
      params: {
        To: phoneNumber,
        // The From parameter will be handled by the webhook based on Twilio configuration
        // But we can pass it explicitly if needed
      },
    })

    console.log('✅ Call object created, setting up listeners...')

    // Set up call event listeners for the outbound call
    setupCallListeners(call, set)

    // The call will be in connecting state until answered
    // When answered, the 'accept' event will fire and update the UI
  } catch (error: any) {
    console.error('❌ Failed to make call:', error)
    set(voiceErrorAtom, error?.response?.data?.message || error?.message || 'Failed to make call')
    set(isConnectingAtom, false)
    throw error
  }
})

// Answer call action
const answerCallAction = atom(null, (get, _set) => {
  const incomingCall = get(incomingCallAtom)
  if (incomingCall) {
    incomingCall.accept()
  }
})

// Reject call action
const rejectCallAction = atom(null, (get, _set) => {
  const incomingCall = get(incomingCallAtom)
  if (incomingCall) {
    incomingCall.reject()
  }
})

// Hangup call action
const hangupCallAction = atom(null, async (get, set) => {
  try {
    const activeCall = get(activeCallAtom)
    const incomingCall = get(incomingCallAtom)

    // Disconnect Voice SDK call if active
    if (activeCall) {
      activeCall.disconnect()
    }

    // Reject incoming call if present
    if (incomingCall) {
      incomingCall.reject()
    }

    // Reset call state
    set(activeCallAtom, null)
    set(incomingCallAtom, null)
    set(isConnectingAtom, false)
    set(isMutedAtom, false)
  } catch (error: any) {
    console.error('Error hanging up call:', error)
    set(voiceErrorAtom, 'Failed to hang up call')
  }
})

// Mute call action
const muteCallAction = atom(null, (get, set) => {
  const activeCall = get(activeCallAtom)
  if (activeCall) {
    activeCall.mute(true)
    set(isMutedAtom, true)
  }
})

// Unmute call action
const unmuteCallAction = atom(null, (get, set) => {
  const activeCall = get(activeCallAtom)
  if (activeCall) {
    activeCall.mute(false)
    set(isMutedAtom, false)
  }
})

// Custom hook to replace useVoice
export const useVoice = () => {
  const isReady = useAtomValue(isReadyAtom)
  const isConnecting = useAtomValue(isConnectingAtom)
  const activeCall = useAtomValue(activeCallAtom)
  const incomingCall = useAtomValue(incomingCallAtom)
  const isMuted = useAtomValue(isMutedAtom)
  const callStatus = useAtomValue(callStatusAtom)
  const error = useAtomValue(voiceErrorAtom)

  const makeCall = useSetAtom(makeCallAction)
  const answerCall = useSetAtom(answerCallAction)
  const rejectCall = useSetAtom(rejectCallAction)
  const hangupCall = useSetAtom(hangupCallAction)
  const muteCall = useSetAtom(muteCallAction)
  const unmuteCall = useSetAtom(unmuteCallAction)

  return {
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
}

// Hook for voice initialization that responds to auth changes
export const useVoiceInit = () => {
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)
  const initializeDevice = useSetAtom(initializeDeviceAction)
  const cleanupDevice = useSetAtom(cleanupDeviceAction)

  return { isAuthenticated, initializeDevice, cleanupDevice }
}
