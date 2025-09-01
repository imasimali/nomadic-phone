import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  LinearProgress,
} from '@mui/material';
import {
  Phone,
  CallEnd,
  Mic,
  MicOff,
  VolumeUp,
  VolumeOff,
  Dialpad,
} from '@mui/icons-material';
import { useVoice } from '../../contexts/VoiceContext';

const VoicePanel: React.FC = () => {
  const {
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
  } = useVoice();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [callError, setCallError] = useState('');
  const [showDialpad, setShowDialpad] = useState(false);
  const [isDialing, setIsDialing] = useState(false);

  useEffect(() => {
    if (error) {
      setCallError(error);
    }
  }, [error]);

  const handleMakeCall = async () => {
    if (!phoneNumber.trim()) {
      setCallError('Please enter a phone number');
      return;
    }

    // Basic phone number validation
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10) {
      setCallError('Please enter a valid phone number');
      return;
    }

    // Format to E.164 if needed
    let formattedNumber = phoneNumber;
    if (!phoneNumber.startsWith('+')) {
      formattedNumber = cleanNumber.length === 10 ? `+1${cleanNumber}` : `+${cleanNumber}`;
    }

    try {
      setCallError('');
      setIsDialing(true);
      await makeCall(formattedNumber);
    } catch (error: any) {
      setCallError(error.message || 'Failed to make call');
    } finally {
      setIsDialing(false);
    }
  };

  const handleHangup = () => {
    hangupCall();
    setPhoneNumber('');
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      unmuteCall();
    } else {
      muteCall();
    }
  };

  const dialpadNumbers = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
  ];

  const handleDialpadClick = (digit: string) => {
    setPhoneNumber(prev => prev + digit);
  };

  const getCallStatusColor = () => {
    switch (callStatus) {
      case 'connecting':
        return 'warning';
      case 'connected':
        return 'success';
      case 'incoming':
        return 'info';
      default:
        return 'default';
    }
  };

  const formatPhoneNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return number;
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Voice Calls
      </Typography>

      <Grid container spacing={3}>
        {/* Voice Status */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Phone sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Voice Service</Typography>
                </Box>
                <Chip
                  label={isReady ? 'Ready' : 'Connecting...'}
                  color={isReady ? 'success' : 'warning'}
                  variant="outlined"
                />
              </Box>
              {!isReady && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Initializing voice service...
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Call Interface */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Make a Call
              </Typography>

              {callError && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {callError}
                </Alert>
              )}

              {callStatus && (
                <Alert 
                  severity={getCallStatusColor() as any} 
                  sx={{ mb: 2 }}
                >
                  Call Status: {callStatus}
                  {activeCall && (
                    <Typography variant="body2">
                      {formatPhoneNumber(activeCall.parameters.To || '')}
                    </Typography>
                  )}
                </Alert>
              )}

              <TextField
                fullWidth
                label="Phone Number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 (555) 123-4567"
                disabled={!!activeCall || isConnecting}
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: (
                    <IconButton
                      onClick={() => setShowDialpad(true)}
                      disabled={!!activeCall || isConnecting}
                    >
                      <Dialpad />
                    </IconButton>
                  ),
                }}
              />

              <Box sx={{ display: 'flex', gap: 1 }}>
                {!activeCall && !isConnecting ? (
                  <Button
                    variant="contained"
                    startIcon={<Phone />}
                    onClick={handleMakeCall}
                    disabled={!isReady || !phoneNumber.trim() || isDialing}
                    fullWidth
                  >
                    {isDialing ? 'Calling...' : 'Call'}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<CallEnd />}
                      onClick={handleHangup}
                      fullWidth
                    >
                      Hang Up
                    </Button>
                    {activeCall && (
                      <Button
                        variant="outlined"
                        startIcon={isMuted ? <MicOff /> : <Mic />}
                        onClick={handleMuteToggle}
                        color={isMuted ? 'error' : 'primary'}
                      >
                        {isMuted ? 'Unmute' : 'Mute'}
                      </Button>
                    )}
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Call Controls */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Call Controls
              </Typography>

              {activeCall ? (
                <Box>
                  <Typography variant="body1" gutterBottom>
                    Active Call: {formatPhoneNumber(activeCall.parameters.To || '')}
                  </Typography>
                  
                  <Grid container spacing={2} sx={{ mt: 2 }}>
                    <Grid item xs={6}>
                      <Button
                        variant={isMuted ? 'contained' : 'outlined'}
                        color={isMuted ? 'error' : 'primary'}
                        startIcon={isMuted ? <MicOff /> : <Mic />}
                        onClick={handleMuteToggle}
                        fullWidth
                      >
                        {isMuted ? 'Unmute' : 'Mute'}
                      </Button>
                    </Grid>
                    <Grid item xs={6}>
                      <Button
                        variant="outlined"
                        startIcon={<VolumeUp />}
                        fullWidth
                        disabled
                      >
                        Speaker
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No active call. Make a call to see controls.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Calls */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Dial
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Common numbers for quick dialing
              </Typography>
              
              <Grid container spacing={1}>
                {['+1 (555) 123-4567', '+1 (555) 987-6543', '+1 (555) 555-5555'].map((number) => (
                  <Grid item key={number}>
                    <Chip
                      label={number}
                      onClick={() => setPhoneNumber(number)}
                      clickable
                      variant="outlined"
                      disabled={!!activeCall || isConnecting}
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Incoming Call Dialog */}
      <Dialog open={!!incomingCall} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ textAlign: 'center' }}>
            <Phone sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5">Incoming Call</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6">
              {incomingCall && formatPhoneNumber(incomingCall.parameters.From || '')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Incoming voice call
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button
            variant="contained"
            color="error"
            startIcon={<CallEnd />}
            onClick={rejectCall}
            sx={{ mr: 2 }}
          >
            Decline
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<Phone />}
            onClick={answerCall}
          >
            Answer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialpad Dialog */}
      <Dialog open={showDialpad} onClose={() => setShowDialpad(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Dialpad</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            sx={{ mb: 2 }}
          />
          <Grid container spacing={1}>
            {dialpadNumbers.map((row, rowIndex) => (
              row.map((digit) => (
                <Grid item xs={4} key={digit}>
                  <Button
                    variant="outlined"
                    onClick={() => handleDialpadClick(digit)}
                    sx={{ width: '100%', height: 56, fontSize: '1.2rem' }}
                  >
                    {digit}
                  </Button>
                </Grid>
              ))
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDialpad(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VoicePanel;
