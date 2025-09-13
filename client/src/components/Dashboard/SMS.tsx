import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  Stack,
} from '@mui/material';
import {
  Send,
} from '@mui/icons-material';
import { smsAPI } from '../../services/api';

const SMS: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const sendMessage = async () => {
    if (!phoneNumber.trim() || !message.trim()) {
      setError('Please enter both phone number and message');
      return;
    }

    // Format to E.164 if needed
    let formattedNumber = phoneNumber;
    if (!phoneNumber.startsWith('+')) {
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      formattedNumber = cleanNumber.length === 10 ? `+1${cleanNumber}` : `+${cleanNumber}`;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      await smsAPI.sendSMS(formattedNumber, message.trim());
      setMessage('');
      setSuccess('Message sent successfully!');
      
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <Box sx={{ pb: 2 }}>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Success Alert */}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Send SMS Card */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Send SMS
          </Typography>

          <Stack spacing={2}>
            <TextField
              fullWidth
              label="Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+1 (555) 123-4567"
              disabled={loading}
            />

            <TextField
              fullWidth
              label="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message here..."
              multiline
              rows={4}
              disabled={loading}
            />

            <Button
              variant="contained"
              size="large"
              startIcon={<Send />}
              onClick={sendMessage}
              disabled={loading || !phoneNumber.trim() || !message.trim()}
              sx={{ minHeight: 56 }}
            >
              {loading ? 'Sending...' : 'Send Message'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Quick Numbers */}
      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Quick Numbers
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Tap a number to use it
          </Typography>
          
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {['+1 (555) 123-4567', '+1 (555) 987-6543', '+1 (555) 555-5555'].map((number) => (
              <Button
                key={number}
                variant="outlined"
                size="small"
                onClick={() => setPhoneNumber(number)}
                disabled={loading}
                sx={{ mb: 1 }}
              >
                {number}
              </Button>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SMS;
