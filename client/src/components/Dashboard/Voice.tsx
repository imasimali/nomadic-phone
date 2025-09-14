import React, { useState } from 'react'
import { Box, Card, CardContent, Typography, TextField, Button, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Fab, Stack } from '@mui/material'
import { Phone, CallEnd, Mic, MicOff } from '@mui/icons-material'
import { useVoice } from '../../contexts/VoiceContext'

const Voice: React.FC = () => {
  const { isReady, isConnecting, activeCall, incomingCall, makeCall, answerCall, rejectCall, hangupCall, muteCall, unmuteCall, isMuted, error } = useVoice()

  const [phoneNumber, setPhoneNumber] = useState('')

  const handleMakeCall = async () => {
    if (!phoneNumber.trim()) return

    // Format to E.164 if needed
    let formattedNumber = phoneNumber
    if (!phoneNumber.startsWith('+')) {
      const cleanNumber = phoneNumber.replace(/\D/g, '')
      formattedNumber = cleanNumber.length === 10 ? `+1${cleanNumber}` : `+${cleanNumber}`
    }

    try {
      await makeCall(formattedNumber)
    } catch (error: any) {
      // Error handled by context
    }
  }

  const handleHangupCall = async () => {
    try {
      await hangupCall()
    } catch (error: any) {
      // Error handled by context
    }
  }

  const formatPhoneNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, '')
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return number
  }

  return (
    <Box sx={{ pb: 2 }}>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Service Status */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Voice Service: {isReady ? '✅ Ready' : '⏳ Connecting...'}
          </Typography>
        </CardContent>
      </Card>

      {/* Phone Input */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <TextField
            fullWidth
            label="Phone Number"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (555) 123-4567"
            disabled={!!activeCall || isConnecting}
            sx={{ mb: 2 }}
          />

          {/* Call Buttons */}
          <Stack spacing={2}>
            {!activeCall && !isConnecting ? (
              <Button variant="contained" size="large" startIcon={<Phone />} onClick={handleMakeCall} disabled={!isReady || !phoneNumber.trim()} sx={{ minHeight: 56 }}>
                Call
              </Button>
            ) : (
              <Stack direction="row" spacing={2}>
                <Button variant="contained" color="error" size="large" startIcon={<CallEnd />} onClick={handleHangupCall} sx={{ flex: 1, minHeight: 56 }}>
                  Hang Up
                </Button>
                {activeCall && (
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={isMuted ? <MicOff /> : <Mic />}
                    onClick={isMuted ? unmuteCall : muteCall}
                    color={isMuted ? 'error' : 'primary'}
                    sx={{ flex: 1, minHeight: 56 }}
                  >
                    {isMuted ? 'Unmute' : 'Mute'}
                  </Button>
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Active Call Info */}
      {activeCall && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" color="success.main">
              📞 Active Call
            </Typography>
            <Typography variant="body1">{formatPhoneNumber(activeCall.parameters.To || '')}</Typography>
          </CardContent>
        </Card>
      )}

      {/* Incoming Call Dialog */}
      <Dialog open={!!incomingCall} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ textAlign: 'center' }}>
          <Phone sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h5">Incoming Call</Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center' }}>
          <Typography variant="h6">{incomingCall && formatPhoneNumber(incomingCall.parameters.From || '')}</Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 3 }}>
          <Fab color="error" onClick={rejectCall} size="large">
            <CallEnd />
          </Fab>
          <Fab color="success" onClick={answerCall} size="large">
            <Phone />
          </Fab>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Voice
