import React, { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material'
import { Save, Refresh, Phone, Info, CheckCircle, Warning } from '@mui/icons-material'
import { voiceAPI, VoiceSettings } from '../../services/api'
import LoadingScreen from '../Common/LoadingScreen'
import { usePageTitle } from '../../hooks/usePageTitle'

const Settings: React.FC = () => {
  usePageTitle('Settings')

  const [settings, setSettings] = useState<VoiceSettings>({
    redirect_number: '',
    voice_message: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [originalSettings, setOriginalSettings] = useState<VoiceSettings | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      setError('')

      const response = await voiceAPI.getSettings()
      const loadedSettings = response.data.settings

      setSettings(loadedSettings)
      setOriginalSettings(loadedSettings)
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      // Validate settings
      if (settings.voice_message.length > 500) {
        setError('Voice message must be 500 characters or less')
        return
      }

      await voiceAPI.updateSettings(settings)
      setSuccess('Settings saved successfully!')
      setOriginalSettings({ ...settings })

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000)
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const resetSettings = () => {
    if (originalSettings) {
      setSettings({ ...originalSettings })
      setError('')
      setSuccess('')
    }
  }

  const hasChanges = () => {
    if (!originalSettings) return false
    return JSON.stringify(settings) !== JSON.stringify(originalSettings)
  }



  if (loading) {
    return <LoadingScreen />
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Voice Settings */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Phone sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Call Handling</Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configure call handling settings. If no redirect number is set, calls will ring in your browser and go to voicemail if unanswered.
              </Typography>

              <Grid container spacing={3}>
                {/* Redirect Number */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Redirect Phone Number (Optional)"
                    placeholder="+1234567890"
                    value={settings.redirect_number || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        redirect_number: e.target.value,
                      })
                    }
                    helperText="If set, all incoming calls will be forwarded to this number. Leave empty to ring in browser."
                  />
                </Grid>

                {/* Voice Message */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    label="Voicemail Message"
                    placeholder="Hello, you've reached my voicemail. Please leave a message after the beep."
                    value={settings.voice_message}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        voice_message: e.target.value,
                      })
                    }
                    helperText={`${settings.voice_message.length}/500 characters`}
                    error={settings.voice_message.length > 500}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button variant="outlined" onClick={resetSettings} disabled={!hasChanges() || saving}>
                  Reset
                </Button>
                <Button variant="outlined" startIcon={<Refresh />} onClick={loadSettings} disabled={saving}>
                  Reload
                </Button>
                <Button variant="contained" startIcon={<Save />} onClick={saveSettings} disabled={saving || !hasChanges()}>
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Settings Info */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Info sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="h6">Settings Information</Typography>
              </Box>

              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Phone color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Default Behavior"
                    secondary="Calls ring in browser, go to voicemail if unanswered"
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <Phone color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Redirect (Optional)"
                    secondary="Forward all calls to another number if configured"
                  />
                </ListItem>
              </List>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Current Status
                </Typography>
                <Chip
                  icon={hasChanges() ? <Warning /> : <CheckCircle />}
                  label={hasChanges() ? 'Unsaved Changes' : 'Settings Saved'}
                  color={hasChanges() ? 'warning' : 'success'}
                  variant="outlined"
                  size="small"
                />
              </Box>

              <Typography variant="body2" color="text.secondary">
                <strong>Note:</strong> Settings are managed through environment variables and will be saved for future use.
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Future: Twilio Credentials */}
        <Grid item xs={12} lg={8}>
          <Card sx={{ opacity: 0.6 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Info sx={{ mr: 1, color: 'info.main' }} />
                <Typography variant="h6">Twilio Credentials</Typography>
                <Chip label="Coming Soon" size="small" sx={{ ml: 2 }} />
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                In the future, you'll be able to configure your Twilio Account SID, Auth Token, and other credentials directly from this interface.
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Account SID"
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    disabled
                    helperText="Your Twilio Account SID"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Auth Token"
                    type="password"
                    placeholder="••••••••••••••••••••••••••••••••"
                    disabled
                    helperText="Your Twilio Auth Token"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default Settings
