import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
} from '@mui/material';
import {
  Save,
  Refresh,
  Phone,
  Voicemail,
  Info,
  CheckCircle,
  Warning,
} from '@mui/icons-material';
import { voiceAPI, VoiceSettings } from '../../services/api';
import LoadingScreen from '../Common/LoadingScreen';

const Settings: React.FC = () => {
  const [settings, setSettings] = useState<VoiceSettings>({
    incoming_call_action: 'recording',
    redirect_number: '',
    voice_language: 'en-US',
    voice_message: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [originalSettings, setOriginalSettings] = useState<VoiceSettings | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await voiceAPI.getSettings();
      const loadedSettings = response.data.settings;
      
      setSettings(loadedSettings);
      setOriginalSettings(loadedSettings);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // Validate settings
      if (settings.incoming_call_action === 'redirect' && !settings.redirect_number) {
        setError('Redirect number is required when using redirect action');
        return;
      }

      if (settings.voice_message.length > 500) {
        setError('Voice message must be 500 characters or less');
        return;
      }

      await voiceAPI.updateSettings(settings);
      setSuccess('Settings saved successfully!');
      setOriginalSettings({ ...settings });
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    if (originalSettings) {
      setSettings({ ...originalSettings });
      setError('');
      setSuccess('');
    }
  };

  const hasChanges = () => {
    if (!originalSettings) return false;
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  };

  const getActionDescription = (action: string) => {
    switch (action) {
      case 'recording':
        return 'Incoming calls go directly to voicemail';
      case 'client':
        return 'Incoming calls ring in your browser';
      case 'redirect':
        return 'Incoming calls are forwarded to another number';
      default:
        return '';
    }
  };

  const getLanguageLabel = (code: string) => {
    const languages: { [key: string]: string } = {
      'en-US': 'English (US)',
      'en-GB': 'English (UK)',
      'es-ES': 'Spanish (Spain)',
      'es-MX': 'Spanish (Mexico)',
      'fr-FR': 'French',
      'de-DE': 'German',
      'it-IT': 'Italian',
      'pt-BR': 'Portuguese (Brazil)',
      'ja-JP': 'Japanese',
      'ko-KR': 'Korean',
      'zh-CN': 'Chinese (Simplified)',
    };
    return languages[code] || code;
  };

  if (loading) {
    return <LoadingScreen />;
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
                <Typography variant="h6">Voice Settings</Typography>
              </Box>

              <Grid container spacing={3}>
                {/* Incoming Call Action */}
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Incoming Call Action</InputLabel>
                    <Select
                      value={settings.incoming_call_action}
                      label="Incoming Call Action"
                      onChange={(e) => setSettings({
                        ...settings,
                        incoming_call_action: e.target.value as 'recording' | 'client' | 'redirect'
                      })}
                    >
                      <MenuItem value="recording">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Voicemail sx={{ mr: 1 }} />
                          Voicemail
                        </Box>
                      </MenuItem>
                      <MenuItem value="client">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Phone sx={{ mr: 1 }} />
                          Ring Browser
                        </Box>
                      </MenuItem>
                      <MenuItem value="redirect">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Phone sx={{ mr: 1 }} />
                          Forward to Number
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {getActionDescription(settings.incoming_call_action)}
                  </Typography>
                </Grid>

                {/* Redirect Number */}
                {settings.incoming_call_action === 'redirect' && (
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Redirect Phone Number"
                      placeholder="+1234567890"
                      value={settings.redirect_number || ''}
                      onChange={(e) => setSettings({
                        ...settings,
                        redirect_number: e.target.value
                      })}
                      helperText="Enter phone number in E.164 format (e.g., +1234567890)"
                    />
                  </Grid>
                )}

                {/* Voice Language */}
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Voice Language</InputLabel>
                    <Select
                      value={settings.voice_language}
                      label="Voice Language"
                      onChange={(e) => setSettings({
                        ...settings,
                        voice_language: e.target.value
                      })}
                    >
                      <MenuItem value="en-US">{getLanguageLabel('en-US')}</MenuItem>
                      <MenuItem value="en-GB">{getLanguageLabel('en-GB')}</MenuItem>
                      <MenuItem value="es-ES">{getLanguageLabel('es-ES')}</MenuItem>
                      <MenuItem value="es-MX">{getLanguageLabel('es-MX')}</MenuItem>
                      <MenuItem value="fr-FR">{getLanguageLabel('fr-FR')}</MenuItem>
                      <MenuItem value="de-DE">{getLanguageLabel('de-DE')}</MenuItem>
                      <MenuItem value="it-IT">{getLanguageLabel('it-IT')}</MenuItem>
                      <MenuItem value="pt-BR">{getLanguageLabel('pt-BR')}</MenuItem>
                      <MenuItem value="ja-JP">{getLanguageLabel('ja-JP')}</MenuItem>
                      <MenuItem value="ko-KR">{getLanguageLabel('ko-KR')}</MenuItem>
                      <MenuItem value="zh-CN">{getLanguageLabel('zh-CN')}</MenuItem>
                    </Select>
                  </FormControl>
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
                    onChange={(e) => setSettings({
                      ...settings,
                      voice_message: e.target.value
                    })}
                    helperText={`${settings.voice_message.length}/500 characters`}
                    error={settings.voice_message.length > 500}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={resetSettings}
                  disabled={!hasChanges() || saving}
                >
                  Reset
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={loadSettings}
                  disabled={saving}
                >
                  Reload
                </Button>
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={saveSettings}
                  disabled={saving || !hasChanges()}
                >
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
                    <Voicemail color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Voicemail"
                    secondary="Calls go directly to voicemail recording"
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <Phone color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Ring Browser"
                    secondary="Calls ring in your web browser"
                  />
                </ListItem>

                <ListItem>
                  <ListItemIcon>
                    <Phone color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Forward"
                    secondary="Calls are forwarded to another number"
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
                <strong>Note:</strong> Settings are stored as environment variables. 
                In a production setup, these would be persisted to a database.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Settings;
