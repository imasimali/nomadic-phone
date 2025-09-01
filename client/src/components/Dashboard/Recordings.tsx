import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Grid,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  ListItemIcon,
  ListItemText,
  Divider,
  Paper,
} from '@mui/material';
import {
  PlayArrow,
  Download,
  Delete,
  Search,
  Refresh,
  MoreVert,
  CallMade,
  CallReceived,
  Voicemail,
  FilterList,
  Clear,
  Pause,
  VolumeUp,
} from '@mui/icons-material';
import { voiceAPI, Call } from '../../services/api';
import LoadingScreen from '../Common/LoadingScreen';
import axios from 'axios';

interface Recording extends Call {
  recording_url: string;
  recording_sid: string;
  recording_duration: number;
}

const Recordings: React.FC = () => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalRecordings, setTotalRecordings] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [filters, setFilters] = useState({
    direction: '',
    search: '',
    dateRange: '',
  });
  const [recordingBlobs, setRecordingBlobs] = useState<Map<string, string>>(new Map());
  const [dialogBlobUrl, setDialogBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    loadRecordings();
  }, [page, rowsPerPage, filters]);

  useEffect(() => {
    // Cleanup audio when component unmounts
    return () => {
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
      }
      // Cleanup blob URLs
      recordingBlobs.forEach(blobUrl => {
        URL.revokeObjectURL(blobUrl);
      });
    };
  }, [audioElement, recordingBlobs]);

  const fetchRecordingBlob = async (recordingSid: string, recordingUrl: string): Promise<string> => {
    // Check if we already have a blob URL for this recording
    if (recordingBlobs.has(recordingSid)) {
      return recordingBlobs.get(recordingSid)!;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const response = await axios.get(recordingUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        responseType: 'blob',
      });

      const blobUrl = URL.createObjectURL(response.data);
      setRecordingBlobs(prev => new Map(prev.set(recordingSid, blobUrl)));
      return blobUrl;
    } catch (error) {
      console.error('Failed to fetch recording:', error);
      throw new Error('Failed to load recording');
    }
  };

  const loadRecordings = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params: any = {
        page: page + 1,
        limit: rowsPerPage,
      };
      
      if (filters.direction) params.direction = filters.direction;
      
      const response = await voiceAPI.getCalls(params);
      
      // Filter only calls that have recordings
      const recordingsOnly = response.data.calls.filter((call: Call) => 
        call.recording_url && call.recording_url.trim() !== ''
      ) as Recording[];
      
      // Apply search filter if provided
      let filteredRecordings = recordingsOnly;
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredRecordings = recordingsOnly.filter(recording =>
          recording.from_number.toLowerCase().includes(searchTerm) ||
          recording.to_number.toLowerCase().includes(searchTerm) ||
          (recording.from_city && recording.from_city.toLowerCase().includes(searchTerm)) ||
          (recording.to_city && recording.to_city.toLowerCase().includes(searchTerm))
        );
      }
      
      setRecordings(filteredRecordings);
      setTotalRecordings(filteredRecordings.length);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load recordings');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, recording: Recording) => {
    setAnchorEl(event.currentTarget);
    setSelectedRecording(recording);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedRecording(null);
  };

  const handlePlayRecording = async (recording?: Recording) => {
    const recordingToPlay = recording || selectedRecording;
    if (!recordingToPlay?.recording_url) return;

    // Stop currently playing audio
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }

    if (currentlyPlaying === recordingToPlay.recording_sid) {
      // Stop playing
      setCurrentlyPlaying(null);
      setAudioElement(null);
    } else {
      try {
        // Get authenticated blob URL
        const recordingUrl = recordingToPlay.recording_url.startsWith('http')
          ? recordingToPlay.recording_url
          : `${window.location.origin}${recordingToPlay.recording_url}`;

        const blobUrl = await fetchRecordingBlob(recordingToPlay.recording_sid, recordingUrl);

        const audio = new Audio(blobUrl);
        audio.onended = () => {
          setCurrentlyPlaying(null);
          setAudioElement(null);
        };
        audio.onerror = () => {
          setError('Failed to play recording');
          setCurrentlyPlaying(null);
          setAudioElement(null);
        };

        await audio.play();
        setCurrentlyPlaying(recordingToPlay.recording_sid);
        setAudioElement(audio);
      } catch (error) {
        setError('Failed to play recording');
        setCurrentlyPlaying(null);
        setAudioElement(null);
      }
    }

    handleMenuClose();
  };

  const handleDownloadRecording = async () => {
    if (selectedRecording?.recording_url) {
      try {
        const recordingUrl = selectedRecording.recording_url.startsWith('http')
          ? selectedRecording.recording_url
          : `${window.location.origin}${selectedRecording.recording_url}`;

        const blobUrl = await fetchRecordingBlob(selectedRecording.recording_sid, recordingUrl);

        // Create a temporary download link
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `recording-${selectedRecording.recording_sid}.mp3`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (error) {
        setError('Failed to download recording');
      }
    }
    handleMenuClose();
  };

  const handleShowRecordingDialog = async () => {
    if (selectedRecording?.recording_url) {
      try {
        const recordingUrl = selectedRecording.recording_url.startsWith('http')
          ? selectedRecording.recording_url
          : `${window.location.origin}${selectedRecording.recording_url}`;

        const blobUrl = await fetchRecordingBlob(selectedRecording.recording_sid, recordingUrl);
        setDialogBlobUrl(blobUrl);
        setShowRecordingDialog(true);
      } catch (error) {
        setError('Failed to load recording');
      }
    }
    handleMenuClose();
  };

  const formatPhoneNumber = (phoneNumber: string) => {
    if (phoneNumber.startsWith('+1') && phoneNumber.length === 12) {
      return `+1 (${phoneNumber.slice(2, 5)}) ${phoneNumber.slice(5, 8)}-${phoneNumber.slice(8)}`;
    }
    return phoneNumber;
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleString();
  };

  const clearFilters = () => {
    setFilters({
      direction: '',
      search: '',
      dateRange: '',
    });
    setPage(0);
  };

  const getRecordingTypeIcon = (recording: Recording) => {
    if (recording.direction === 'inbound' && recording.duration === 0) {
      return <Voicemail color="primary" />;
    }
    return recording.direction === 'inbound' ? 
      <CallReceived color="success" /> : 
      <CallMade color="info" />;
  };

  const getRecordingTypeLabel = (recording: Recording) => {
    if (recording.direction === 'inbound' && recording.duration === 0) {
      return 'Voicemail';
    }
    return recording.direction === 'inbound' ? 'Incoming Call' : 'Outgoing Call';
  };

  if (loading && recordings.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Recordings
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search recordings..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Direction</InputLabel>
                <Select
                  value={filters.direction}
                  label="Direction"
                  onChange={(e) => setFilters({ ...filters, direction: e.target.value })}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="inbound">Inbound</MenuItem>
                  <MenuItem value="outbound">Outbound</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                startIcon={<Clear />}
                onClick={clearFilters}
                disabled={!filters.direction && !filters.search}
              >
                Clear Filters
              </Button>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={() => loadRecordings()}
                disabled={loading}
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Recording</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recordings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Box sx={{ py: 4 }}>
                        <Typography variant="body1" color="text.secondary">
                          No recordings found
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Recordings will appear here when calls are recorded
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  recordings.map((recording) => (
                    <TableRow key={recording.recording_sid} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {getRecordingTypeIcon(recording)}
                          <Box sx={{ ml: 1 }}>
                            <Typography variant="body2">
                              {getRecordingTypeLabel(recording)}
                            </Typography>
                            <Chip
                              label={recording.status}
                              size="small"
                              color={recording.status === 'completed' ? 'success' : 'default'}
                              variant="outlined"
                            />
                          </Box>
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {formatPhoneNumber(
                            recording.direction === 'outbound' 
                              ? recording.to_number 
                              : recording.from_number
                          )}
                        </Typography>
                        {(recording.direction === 'outbound' ? recording.to_city : recording.from_city) && (
                          <Typography variant="caption" color="text.secondary">
                            {recording.direction === 'outbound' ? recording.to_city : recording.from_city}
                            {(recording.direction === 'outbound' ? recording.to_state : recording.from_state) && 
                              `, ${recording.direction === 'outbound' ? recording.to_state : recording.from_state}`
                            }
                          </Typography>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(recording.start_time)}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {recording.recording_duration 
                            ? formatDuration(recording.recording_duration)
                            : 'Unknown'
                          }
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handlePlayRecording(recording)}
                          color={currentlyPlaying === recording.recording_sid ? 'secondary' : 'primary'}
                        >
                          {currentlyPlaying === recording.recording_sid ? <Pause /> : <PlayArrow />}
                        </IconButton>
                      </TableCell>
                      
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, recording)}
                        >
                          <MoreVert />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={totalRecordings}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </CardContent>
      </Card>

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handlePlayRecording()}>
          <ListItemIcon>
            {currentlyPlaying === selectedRecording?.recording_sid ? <Pause /> : <PlayArrow />}
          </ListItemIcon>
          <ListItemText>
            {currentlyPlaying === selectedRecording?.recording_sid ? 'Pause' : 'Play Recording'}
          </ListItemText>
        </MenuItem>
        
        <MenuItem onClick={handleShowRecordingDialog}>
          <ListItemIcon>
            <VolumeUp />
          </ListItemIcon>
          <ListItemText>Open Player</ListItemText>
        </MenuItem>
        
        <MenuItem onClick={handleDownloadRecording}>
          <ListItemIcon>
            <Download />
          </ListItemIcon>
          <ListItemText>Download</ListItemText>
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <Delete />
          </ListItemIcon>
          <ListItemText>Delete Recording</ListItemText>
        </MenuItem>
      </Menu>

      {/* Recording Dialog */}
      <Dialog
        open={showRecordingDialog}
        onClose={() => {
          setShowRecordingDialog(false);
          setDialogBlobUrl(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {selectedRecording && getRecordingTypeIcon(selectedRecording)}
            <Box sx={{ ml: 1 }}>
              <Typography variant="h6">
                {selectedRecording && getRecordingTypeLabel(selectedRecording)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {selectedRecording && formatDate(selectedRecording.start_time)}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {selectedRecording && dialogBlobUrl && (
            <Box>
              <Typography variant="body2" gutterBottom>
                Contact: {formatPhoneNumber(
                  selectedRecording.direction === 'outbound'
                    ? selectedRecording.to_number
                    : selectedRecording.from_number
                )}
              </Typography>

              <Typography variant="caption" color="text.secondary" gutterBottom>
                Duration: {selectedRecording.recording_duration
                  ? formatDuration(selectedRecording.recording_duration)
                  : 'Unknown'
                }
              </Typography>

              <Box sx={{ mt: 2 }}>
                <audio controls style={{ width: '100%' }}>
                  <source src={dialogBlobUrl} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </Box>
            </Box>
          )}
          {selectedRecording && !dialogBlobUrl && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Loading recording...
              </Typography>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => {
            setShowRecordingDialog(false);
            setDialogBlobUrl(null);
          }}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={handleDownloadRecording}
            startIcon={<Download />}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Recordings;
