import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Alert,
  Stack,
  IconButton,
} from '@mui/material'
import { Send, Close } from '@mui/icons-material'
import { smsAPI } from '../../services/api'

interface SMSModalProps {
  open: boolean
  onClose: () => void
  onMessageSent?: () => void
  initialPhoneNumber?: string
}

const SMSModal: React.FC<SMSModalProps> = ({ open, onClose, onMessageSent, initialPhoneNumber = '' }) => {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (open) {
      setPhoneNumber(initialPhoneNumber)
      setMessage('')
      setError('')
      setSuccess('')
    }
  }, [open, initialPhoneNumber])

  const sendMessage = async () => {
    if (!phoneNumber.trim() || !message.trim()) {
      setError('Please enter both phone number and message')
      return
    }

    // Format to E.164 if needed
    let formattedNumber = phoneNumber
    if (!phoneNumber.startsWith('+')) {
      const cleanNumber = phoneNumber.replace(/\D/g, '')
      formattedNumber = cleanNumber.length === 10 ? `+1${cleanNumber}` : `+${cleanNumber}`
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')

      await smsAPI.sendSMS(formattedNumber, message.trim())
      setMessage('')
      setSuccess('Message sent successfully!')
      
      // Call the callback to refresh conversations
      onMessageSent?.()
      
      // Close modal after a short delay to show success message
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to send message')
    } finally {
      setLoading(false)
    }
  }



  const handleClose = () => {
    if (!loading) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        New Message
        <IconButton onClick={handleClose} disabled={loading}>
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
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

        <Stack spacing={2} sx={{ mt: 1 }}>
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Type your message here..."
            multiline
            rows={4}
            disabled={loading}
          />


        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<Send />}
          onClick={sendMessage}
          disabled={loading || !phoneNumber.trim() || !message.trim()}
        >
          {loading ? 'Sending...' : 'Send Message'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default SMSModal
