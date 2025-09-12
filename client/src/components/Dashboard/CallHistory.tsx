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
} from '@mui/material';
import {
  CallMade,
  CallReceived,
  MoreVert,
  Refresh,
  PlayArrow,
  Download,
  Delete,
  Search,
} from '@mui/icons-material';
import { voiceAPI, Call } from '../../services/api';
import LoadingScreen from '../Common/LoadingScreen';

const CallHistory: React.FC = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCalls, setTotalCalls] = useState(0);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [filters, setFilters] = useState({
    direction: '',
    status: '',
    search: '',
  });
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);

  useEffect(() => {
    loadCalls();
  }, [page, rowsPerPage, filters]);

  const loadCalls = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params: any = {
        page: page + 1,
        limit: rowsPerPage,
      };
      
      if (filters.direction) params.direction = filters.direction;
      if (filters.status) params.status = filters.status;
      
      const response = await voiceAPI.getCalls(params);
      setCalls(response.data.calls);
      setTotalCalls(response.data.pagination.total);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load call history');
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

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, call: Call) => {
    setAnchorEl(event.currentTarget);
    setSelectedCall(call);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedCall(null);
  };

  const handlePlayRecording = () => {
    if (selectedCall?.recording_url) {
      setShowRecordingDialog(true);
    }
    handleMenuClose();
  };

  const handleDownloadRecording = () => {
    if (selectedCall?.recording_url) {
      window.open(selectedCall.recording_url, '_blank');
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
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
      case 'busy':
      case 'no-answer':
        return 'error';
      case 'in-progress':
        return 'info';
      default:
        return 'default';
    }
  };

  const filteredCalls = calls.filter(call => {
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      return (
        call.from_number.toLowerCase().includes(searchTerm) ||
        call.to_number.toLowerCase().includes(searchTerm) ||
        call.status.toLowerCase().includes(searchTerm)
      );
    }
    return true;
  });

  if (loading) {
    return <LoadingScreen message="Loading call history..." />;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Call History
      </Typography>

      <Card>
        <CardContent>
          {/* Filters */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Search"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
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
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status}
                  label="Status"
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="failed">Failed</MenuItem>
                  <MenuItem value="busy">Busy</MenuItem>
                  <MenuItem value="no-answer">No Answer</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Button
                variant="outlined"
                startIcon={<Refresh />}
                onClick={loadCalls}
                disabled={loading}
                fullWidth
              >
                Refresh
              </Button>
            </Grid>
          </Grid>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Calls Table */}
          <TableContainer sx={{
            overflowX: 'auto',
            '& .MuiTable-root': {
              minWidth: { xs: 650, sm: 'auto' }
            }
          }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Direction</TableCell>
                  <TableCell>Number</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Duration</TableCell>
                  <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Date</TableCell>
                  <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Location</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredCalls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No calls found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCalls.map((call) => (
                    <TableRow key={call.id} hover>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        {call.direction === 'outbound' ? (
                          <CallMade color="primary" />
                        ) : (
                          <CallReceived color="secondary" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {/* Show direction icon on mobile */}
                          <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
                            {call.direction === 'outbound' ? (
                              <CallMade color="primary" fontSize="small" />
                            ) : (
                              <CallReceived color="secondary" fontSize="small" />
                            )}
                          </Box>
                          <Box>
                            {formatPhoneNumber(
                              call.direction === 'outbound' ? call.to_number : call.from_number
                            )}
                            {/* Show date on mobile */}
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: { xs: 'block', lg: 'none' },
                                fontSize: '0.75rem'
                              }}
                            >
                              {formatDate(call.created_at)}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={call.status}
                          color={getStatusColor(call.status) as any}
                          size="small"
                        />
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        {call.duration ? formatDuration(call.duration) : '-'}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                        {formatDate(call.created_at)}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>
                        {call.direction === 'inbound'
                          ? `${call.from_city || ''}, ${call.from_state || ''}`
                          : `${call.to_city || ''}, ${call.to_state || ''}`
                        }
                      </TableCell>
                      <TableCell>
                        <IconButton
                          onClick={(e) => handleMenuOpen(e, call)}
                          size="small"
                          sx={{
                            minWidth: { xs: 44, sm: 'auto' },
                            minHeight: { xs: 44, sm: 'auto' }
                          }}
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

          {/* Pagination */}
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={totalCalls}
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
        {selectedCall?.recording_url && (
          [
            <MenuItem key="play" onClick={handlePlayRecording}>
              <PlayArrow sx={{ mr: 1 }} />
              Play Recording
            </MenuItem>,
            <MenuItem key="download" onClick={handleDownloadRecording}>
              <Download sx={{ mr: 1 }} />
              Download Recording
            </MenuItem>,
          ]
        )}
        <MenuItem onClick={handleMenuClose}>
          <Delete sx={{ mr: 1 }} />
          Delete Call
        </MenuItem>
      </Menu>

      {/* Recording Dialog */}
      <Dialog
        open={showRecordingDialog}
        onClose={() => setShowRecordingDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Call Recording</DialogTitle>
        <DialogContent>
          {selectedCall?.recording_url && (
            <Box>
              <Typography variant="body2" gutterBottom>
                Call with {formatPhoneNumber(
                  selectedCall.direction === 'outbound' 
                    ? selectedCall.to_number 
                    : selectedCall.from_number
                )}
              </Typography>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Duration: {selectedCall.recording_duration 
                  ? formatDuration(selectedCall.recording_duration)
                  : 'Unknown'
                }
              </Typography>
              <Box sx={{ mt: 2 }}>
                <audio controls style={{ width: '100%' }}>
                  <source src={selectedCall.recording_url} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRecordingDialog(false)}>
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

export default CallHistory;
