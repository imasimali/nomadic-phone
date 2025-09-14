import React, { useState, useEffect } from 'react'
import { Box, Card, CardContent, Typography, List, ListItem, ListItemIcon, ListItemText, Alert, Button } from '@mui/material'
import { CallMade, CallReceived, Refresh } from '@mui/icons-material'
import { voiceAPI, Call } from '../../services/api'

const CallHistory: React.FC = () => {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadCalls()
  }, [])

  const loadCalls = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await voiceAPI.getCalls({ limit: 20 })
      setCalls(response.data.calls || [])
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load call history')
    } finally {
      setLoading(false)
    }
  }

  const formatPhoneNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, '')
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return number
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 168) {
      // 7 days
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'No answer'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getCallIcon = (direction: string) => {
    return direction.startsWith('outbound') ? <CallMade color="primary" /> : <CallReceived color="success" />
  }

  const getCallNumber = (call: Call) => {
    return call.direction.startsWith('outbound') ? call.to_number : call.from_number
  }

  return (
    <Box sx={{ pb: 2 }}>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Recent Calls</Typography>
        <Button variant="outlined" startIcon={<Refresh />} onClick={loadCalls} disabled={loading} size="small">
          Refresh
        </Button>
      </Box>

      {/* Call List */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">Loading calls...</Typography>
            </Box>
          ) : calls.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">No calls found</Typography>
            </Box>
          ) : (
            <List>
              {calls.map((call, index) => (
                <ListItem key={call.id} divider={index < calls.length - 1} sx={{ py: 2 }}>
                  <ListItemIcon>{getCallIcon(call.direction)}</ListItemIcon>
                  <ListItemText
                    primary={formatPhoneNumber(getCallNumber(call))}
                    secondary={`${formatDate(call.created_at)} • ${formatDuration(call.duration || 0)} • ${call.status}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Load More */}
      {calls.length >= 20 && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Button variant="outlined" onClick={loadCalls} disabled={loading}>
            Load More
          </Button>
        </Box>
      )}
    </Box>
  )
}

export default CallHistory
