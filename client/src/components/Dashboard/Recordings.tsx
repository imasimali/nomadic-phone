import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Button,
  IconButton,
} from '@mui/material';
import {
  PlayArrow,
  Download,
  Refresh,
  CallMade,
  CallReceived,
  RecordVoiceOver,
  Pause,
} from '@mui/icons-material';
import { voiceAPI, Call } from '../../services/api';

const Recordings: React.FC = () => {
  const [recordings, setRecordings] = useState<Call[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playingRecording, setPlayingRecording] = useState<string | null>(null);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await voiceAPI.getCalls({ limit: 50 });
      // Filter calls that have recordings
      const callsWithRecordings = (response.data.calls || []).filter(
        (call: Call) => call.recording_url && call.recording_sid
      );
      setRecordings(callsWithRecordings);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load recordings');
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return number;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getCallNumber = (call: Call) => {
    return call.direction === 'outbound' ? call.to_number : call.from_number;
  };

  const handlePlayPause = (recordingUrl: string) => {
    if (playingRecording === recordingUrl) {
      setPlayingRecording(null);
      // In a real implementation, you'd pause the audio here
    } else {
      setPlayingRecording(recordingUrl);
      // In a real implementation, you'd start playing the audio here
      // For now, we'll just simulate playing for 3 seconds
      setTimeout(() => {
        setPlayingRecording(null);
      }, 3000);
    }
  };

  const handleDownload = (call: Call) => {
    if (call.recording_url) {
      // Create a temporary link to download the recording
      const link = document.createElement('a');
      link.href = call.recording_url;
      link.download = `recording-${call.call_sid}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Call Recordings
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadRecordings}
          disabled={loading}
          size="small"
        >
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
              {recordings.map((call, index) => (
                <ListItem
                  key={call.id}
                  divider={index < recordings.length - 1}
                  sx={{ py: 2 }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton
                        edge="end"
                        onClick={() => call.recording_url && handlePlayPause(call.recording_url)}
                        color="primary"
                      >
                        {playingRecording === call.recording_url ? <Pause /> : <PlayArrow />}
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => handleDownload(call)}
                        color="primary"
                      >
                        <Download />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemIcon>
                    {call.direction === 'inbound' ? <CallReceived color="success" /> : <CallMade color="info" />}
                  </ListItemIcon>
                  <ListItemText
                    primary={formatPhoneNumber(getCallNumber(call))}
                    secondary={`${formatDate(call.created_at)} • ${formatDuration(call.recording_duration || call.duration || 0)} • ${call.direction}`}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default Recordings;
