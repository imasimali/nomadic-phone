import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Device, Call as TwilioCall } from '@twilio/voice-sdk';
import { voiceAPI } from '../services/api';
import { useAuth } from './AuthContext';

interface VoiceContextType {
  device: Device | null;
  isReady: boolean;
  isConnecting: boolean;
  activeCall: TwilioCall | null;
  incomingCall: TwilioCall | null;
  makeCall: (phoneNumber: string) => Promise<void>;
  answerCall: () => void;
  rejectCall: () => void;
  hangupCall: () => void;
  muteCall: () => void;
  unmuteCall: () => void;
  isMuted: boolean;
  callStatus: string;
  error: string | null;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
};

interface VoiceProviderProps {
  children: ReactNode;
}

export const VoiceProvider: React.FC<VoiceProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [device, setDevice] = useState<Device | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeCall, setActiveCall] = useState<TwilioCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<TwilioCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callStatus, setCallStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Initialize Twilio Device when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      initializeDevice();
    } else {
      cleanupDevice();
    }

    return () => {
      cleanupDevice();
    };
  }, [isAuthenticated]);

  const initializeDevice = async () => {
    try {
      setError(null);

      // Get access token from backend
      const response = await voiceAPI.getToken();

      // Check if the response indicates missing Twilio credentials
      if (response.status === 503) {
        setError('Twilio credentials not configured. Please add your Twilio credentials to the .env file.');
        setIsReady(false);
        return;
      }

      const { token } = response.data;

      // Create and setup Twilio Device
      const newDevice = new Device(token, {
        logLevel: 0,
        allowIncomingWhileBusy: true,
      });

      // Device event listeners
      newDevice.on('registered', () => {
        setIsReady(true);
        setError(null);
      });

      newDevice.on('ready', () => {
        setIsReady(true);
        setError(null);
      });

      newDevice.on('unregistered', () => {
        setIsReady(false);
      });

      newDevice.on('error', (error) => {
        setError(error?.message || error?.toString() || 'Unknown device error');
        setIsReady(false);
      });

      newDevice.on('incoming', (call) => {
        setIncomingCall(call);
        setCallStatus('incoming');

        // Call event listeners
        setupCallListeners(call);
      });

      newDevice.on('tokenWillExpire', async () => {
        try {
          const response = await voiceAPI.getToken();
          newDevice.updateToken(response.data.token);
        } catch (error: any) {
          setError(error?.message || error?.toString() || 'Failed to refresh authentication token');
        }
      });

      // Register the device
      await newDevice.register();
      setDevice(newDevice);

    } catch (error: any) {

      // Handle specific error cases
      if (error?.response?.status === 503) {
        setError(error.response.data?.message || 'Twilio credentials not configured. Please add your Twilio credentials to the .env file.');
      } else {
        let errorMessage = error?.message || error?.toString() || 'Failed to initialize voice service';

        // Add specific guidance for common trial account issues
        if (error?.code === 31205) {
          errorMessage += ' (Invalid access token - check TwiML Application configuration)';
        } else if (error?.message?.includes('token')) {
          errorMessage += ' (Token issue - verify Twilio credentials and Application SID)';
        }

        setError(errorMessage);
      }

      setIsReady(false);
    }
  };

  const cleanupDevice = () => {
    if (device) {
      device.destroy();
      setDevice(null);
    }
    setIsReady(false);
    setActiveCall(null);
    setIncomingCall(null);
    setCallStatus('');
    setError(null);
  };

  const setupCallListeners = (call: TwilioCall) => {
    call.on('accept', () => {
      console.log('Call accepted');
      setActiveCall(call);
      setIncomingCall(null);
      setCallStatus('connected');
      setIsConnecting(false);
    });

    call.on('disconnect', () => {
      console.log('Call disconnected');
      setActiveCall(null);
      setIncomingCall(null);
      setCallStatus('');
      setIsConnecting(false);
      setIsMuted(false);
    });

    call.on('cancel', () => {
      console.log('Call cancelled');
      setIncomingCall(null);
      setCallStatus('');
    });

    call.on('reject', () => {
      console.log('Call rejected');
      setIncomingCall(null);
      setCallStatus('');
    });

    call.on('error', (error) => {
      console.error('Call error:', error);
      setError(error.message);
      setActiveCall(null);
      setIncomingCall(null);
      setCallStatus('');
      setIsConnecting(false);
    });
  };

  const makeCall = async (phoneNumber: string) => {
    if (!device || !isReady) {
      throw new Error('Voice service not ready');
    }

    try {
      setIsConnecting(true);
      setError(null);
      setCallStatus('connecting');

      const call = await device.connect({
        params: { To: phoneNumber }
      });

      setupCallListeners(call);
      setActiveCall(call);

    } catch (error: any) {
      console.error('Failed to make call:', error);
      setError(error?.message || error?.toString() || 'Failed to make call');
      setIsConnecting(false);
      setCallStatus('');
      throw error;
    }
  };

  const answerCall = () => {
    if (incomingCall) {
      incomingCall.accept();
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      incomingCall.reject();
    }
  };

  const hangupCall = () => {
    if (activeCall) {
      activeCall.disconnect();
    }
    if (incomingCall) {
      incomingCall.reject();
    }
  };

  const muteCall = () => {
    if (activeCall) {
      activeCall.mute(true);
      setIsMuted(true);
    }
  };

  const unmuteCall = () => {
    if (activeCall) {
      activeCall.mute(false);
      setIsMuted(false);
    }
  };

  const value: VoiceContextType = {
    device,
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
  };

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};
