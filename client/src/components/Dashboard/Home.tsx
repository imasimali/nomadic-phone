import React, { useEffect, useState } from 'react'
import { Box, Grid, Card, CardContent, Typography, Button, Chip, List, ListItem, ListItemText, ListItemIcon, Divider, Alert } from '@mui/material'
import { Phone, Message, CallMade, CallReceived, CheckCircle, Error, Warning } from '@mui/icons-material'
import { useAuth } from '../../contexts/AuthContext'
import { useVoice } from '../../contexts/VoiceContext'
import { voiceAPI, smsAPI, Call, SMS } from '../../services/api'
import LoadingScreen from '../Common/LoadingScreen'

interface HomeProps {
  onNavigateToTab?: (tab: string) => void
}

const Home: React.FC<HomeProps> = ({ onNavigateToTab }) => {
  const { user } = useAuth()
  const { isReady, device } = useVoice()
  const [stats, setStats] = useState({
    totalCalls: 0,
    totalSMS: 0,
    recentCalls: [] as Call[],
    recentSMS: [] as SMS[],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const [callsResponse, smsResponse] = await Promise.all([voiceAPI.getCalls({ limit: 5 }), smsAPI.getMessages({ limit: 5 })])

      setStats({
        totalCalls: callsResponse.data.pagination.total,
        totalSMS: smsResponse.data.pagination.total,
        recentCalls: callsResponse.data.calls,
        recentSMS: smsResponse.data.messages,
      })
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getVoiceStatus = () => {
    if (!device) {
      return { status: 'Disconnected', color: 'error', icon: <Error /> }
    }
    if (isReady) {
      return { status: 'Ready', color: 'success', icon: <CheckCircle /> }
    }
    return { status: 'Connecting', color: 'warning', icon: <Warning /> }
  }

  const voiceStatus = getVoiceStatus()

  const formatPhoneNumber = (phoneNumber: string) => {
    // Simple phone number formatting
    if (phoneNumber.startsWith('+1') && phoneNumber.length === 12) {
      return `+1 (${phoneNumber.slice(2, 5)}) ${phoneNumber.slice(5, 8)}-${phoneNumber.slice(8)}`
    }
    return phoneNumber
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return <LoadingScreen message="Loading dashboard..." />
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome back, {user?.username}!
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Here's an overview of your Nomadic Phone activity.
      </Typography>

      <Grid container spacing={3}>
        {/* Voice Status Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Phone sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Voice Status</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                {voiceStatus.icon}
                <Chip label={voiceStatus.status} color={voiceStatus.color as any} size="small" sx={{ ml: 1 }} />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {isReady ? 'Ready to make and receive calls' : 'Voice service is initializing...'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Call Stats Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <CallMade sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Calls</Typography>
              </Box>
              <Typography variant="h3" color="primary.main">
                {stats.totalCalls}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total calls made and received
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* SMS Stats Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Message sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Messages</Typography>
              </Box>
              <Typography variant="h3" color="primary.main">
                {stats.totalSMS}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total SMS messages sent and received
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Calls */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Calls
              </Typography>
              {stats.recentCalls.length === 0 ? (
                <Alert severity="info">No recent calls</Alert>
              ) : (
                <List dense>
                  {stats.recentCalls.map((call, index) => (
                    <React.Fragment key={call.id}>
                      <ListItem>
                        <ListItemIcon>{call.direction === 'outbound' ? <CallMade color="primary" /> : <CallReceived color="secondary" />}</ListItemIcon>
                        <ListItemText
                          primary={formatPhoneNumber(call.direction === 'outbound' ? call.to_number : call.from_number)}
                          secondary={
                            <React.Fragment>
                              <Typography variant="caption" component="span" display="block">
                                {call.status} • {formatDate(call.created_at)}
                              </Typography>
                              {call.duration && (
                                <Typography variant="caption" color="text.secondary" component="span" display="block">
                                  Duration: {Math.floor(call.duration / 60)}:{(call.duration % 60).toString().padStart(2, '0')}
                                </Typography>
                              )}
                            </React.Fragment>
                          }
                        />
                      </ListItem>
                      {index < stats.recentCalls.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
              <Button variant="outlined" fullWidth sx={{ mt: 2 }} onClick={() => onNavigateToTab?.('recordings')}>
                View All Calls
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Messages */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Messages
              </Typography>
              {stats.recentSMS.length === 0 ? (
                <Alert severity="info">No recent messages</Alert>
              ) : (
                <List dense>
                  {stats.recentSMS.map((sms, index) => (
                    <React.Fragment key={sms.id}>
                      <ListItem>
                        <ListItemIcon>
                          <Message color={sms.direction === 'outbound' ? 'primary' : 'secondary'} />
                        </ListItemIcon>
                        <ListItemText
                          primary={formatPhoneNumber(sms.direction === 'outbound' ? sms.to_number : sms.from_number)}
                          secondary={
                            <React.Fragment>
                              <Typography variant="body2" noWrap component="span" display="block">
                                {sms.body}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" component="span" display="block">
                                {sms.status} • {formatDate(sms.created_at)}
                              </Typography>
                            </React.Fragment>
                          }
                        />
                      </ListItem>
                      {index < stats.recentSMS.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              )}
              <Button variant="outlined" fullWidth sx={{ mt: 2 }} onClick={() => onNavigateToTab?.('chats')}>
                View All Messages
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Button variant="contained" fullWidth startIcon={<Phone />} onClick={() => onNavigateToTab?.('voice')} disabled={!isReady}>
                    Make Call
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button variant="contained" fullWidth startIcon={<Message />} onClick={() => onNavigateToTab?.('sms')}>
                    Send SMS
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button variant="outlined" fullWidth onClick={() => onNavigateToTab?.('chats')}>
                    View Chats
                  </Button>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Button variant="outlined" fullWidth onClick={() => onNavigateToTab?.('recordings')}>
                    Recordings
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default Home
