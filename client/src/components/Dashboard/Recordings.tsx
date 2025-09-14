import React, { useState, useEffect } from 'react'
import { Box, Card, CardContent, Typography, List, ListItem, ListItemIcon, ListItemText, Alert, Button, IconButton, CircularProgress } from '@mui/material'
import { PlayArrow, Download, Refresh, CallMade, CallReceived, RecordVoiceOver, Pause } from '@mui/icons-material'
import { voiceAPI, Recording } from '../../services/api'

const Recordings: React.FC = () => {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [playingRecording, setPlayingRecording] = useState<string | null>(null)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [loadingAudio, setLoadingAudio] = useState<string | null>(null)

  useEffect(() => {
    loadRecordings()
  }, [])

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause()
        audioElement.currentTime = 0
      }
    }
  }, [audioElement])

  const loadRecordings = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await voiceAPI.getRecordings({ limit: 50 })
      setRecordings(response.data.recordings || [])
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load recordings')
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
    if (!seconds) return '0:00'
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getCallNumber = (recording: Recording) => {
    return recording.direction === 'outbound' ? recording.to_number : recording.from_number
  }

  const handlePlayPause = async (recordingUrl: string) => {
    if (playingRecording === recordingUrl) {
      // Stop current playback
      if (audioElement) {
        audioElement.pause()
        audioElement.currentTime = 0
      }
      setPlayingRecording(null)
      setAudioElement(null)
    } else {
      // Stop any currently playing audio
      if (audioElement) {
        audioElement.pause()
        audioElement.currentTime = 0
      }

      try {
        setLoadingAudio(recordingUrl)

        // Fetch the audio file with authentication
        const response = await fetch(recordingUrl, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to load recording: ${response.statusText}`)
        }

        // Create blob URL for the audio
        const blob = await response.blob()
        const audioUrl = URL.createObjectURL(blob)

        // Create new audio element and start playing
        const audio = new Audio(audioUrl)
        audio.preload = 'auto'

        audio.addEventListener('loadstart', () => {
          console.log('Loading recording...')
        })

        audio.addEventListener('canplay', () => {
          console.log('Recording ready to play')
        })

        audio.addEventListener('ended', () => {
          setPlayingRecording(null)
          setAudioElement(null)
          setLoadingAudio(null)
          URL.revokeObjectURL(audioUrl) // Clean up blob URL
        })

        audio.addEventListener('error', (e) => {
          console.error('Error playing recording:', e)
          setError('Failed to play recording')
          setPlayingRecording(null)
          setAudioElement(null)
          setLoadingAudio(null)
          URL.revokeObjectURL(audioUrl) // Clean up blob URL
        })

        setAudioElement(audio)
        setPlayingRecording(recordingUrl)
        setLoadingAudio(null)

        await audio.play()
      } catch (error) {
        console.error('Error starting playback:', error)
        setError('Failed to start playback. Please try again.')
        setPlayingRecording(null)
        setAudioElement(null)
        setLoadingAudio(null)
      }
    }
  }

  const handleDownload = async (recording: Recording) => {
    if (!recording.recording_url) return

    try {
      // Use fetch to download the recording with proper authentication
      const response = await fetch(recording.recording_url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to download recording: ${response.statusText}`)
      }

      // Create blob from response
      const blob = await response.blob()

      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `recording-${recording.recording_sid}.mp3`
      document.body.appendChild(link)
      link.click()

      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading recording:', error)
      setError('Failed to download recording. Please try again.')
    }
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
        <Typography variant="h6">Call Recordings</Typography>
        <Button variant="outlined" startIcon={<Refresh />} onClick={loadRecordings} disabled={loading} size="small">
          Refresh
        </Button>
      </Box>

      {/* Recordings List */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">Loading recordings...</Typography>
            </Box>
          ) : recordings.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <RecordVoiceOver sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography color="text.secondary" variant="h6" gutterBottom>
                No recordings found
              </Typography>
              <Typography color="text.secondary" variant="body2">
                Call recordings will appear here when available
              </Typography>
            </Box>
          ) : (
            <List>
              {recordings.map((recording, index) => (
                <ListItem
                  key={recording.id}
                  divider={index < recordings.length - 1}
                  sx={{ py: 2 }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton
                        edge="end"
                        onClick={() => recording.recording_url && handlePlayPause(recording.recording_url)}
                        color="primary"
                        disabled={loadingAudio === recording.recording_url}
                      >
                        {loadingAudio === recording.recording_url ? <CircularProgress size={20} /> : playingRecording === recording.recording_url ? <Pause /> : <PlayArrow />}
                      </IconButton>
                      <IconButton edge="end" onClick={() => handleDownload(recording)} color="primary">
                        <Download />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemIcon>{recording.direction === 'inbound' ? <CallReceived color="success" /> : <CallMade color="info" />}</ListItemIcon>
                  <ListItemText
                    primary={formatPhoneNumber(getCallNumber(recording))}
                    secondary={`${formatDate(recording.created_at)} • ${formatDuration(recording.recording_duration || recording.duration || 0)} • ${recording.direction}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

export default Recordings
