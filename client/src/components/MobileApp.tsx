import React, { useState } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  BottomNavigation,
  BottomNavigationAction,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
  Button,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Phone,
  Message,
  Chat as ChatIcon,
  RecordVoiceOver,
  Settings as SettingsIcon,
  AccountCircle,
  Logout,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useVoice } from '../contexts/VoiceContext';
import VoicePanel from './Dashboard/VoicePanel';
import SMSPanel from './Dashboard/SMSPanel';
import Chat from './Dashboard/Chat';
import Recordings from './Dashboard/Recordings';
import Settings from './Dashboard/Settings';
import DashboardHome from './Dashboard/DashboardHome';

type TabValue = 'dashboard' | 'voice' | 'sms' | 'chats' | 'recordings';

const MobileApp: React.FC = () => {
  const { user, logout } = useAuth();
  const { incomingCall } = useVoice();
  const [currentTab, setCurrentTab] = useState<TabValue>('dashboard');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleProfileMenuClose();
  };

  const handleShowSettings = () => {
    setShowSettings(true);
    handleProfileMenuClose();
  };

  const renderCurrentTab = () => {
    if (showSettings) {
      return <Settings />;
    }

    switch (currentTab) {
      case 'dashboard':
        return <DashboardHome onNavigateToTab={(tab) => setCurrentTab(tab as any)} />;
      case 'voice':
        return <VoicePanel />;
      case 'sms':
        return <SMSPanel />;
      case 'chats':
        return <Chat />;
      case 'recordings':
        return <Recordings />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top App Bar */}
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {showSettings ? 'Settings' :
             currentTab === 'dashboard' ? 'Dashboard' :
             currentTab === 'voice' ? 'Voice' :
             currentTab === 'sms' ? 'Messages' :
             currentTab === 'chats' ? 'Chats' :
             currentTab === 'recordings' ? 'Recordings' :
             'Nomadic Phone'}
          </Typography>

          {/* Back button when in settings */}
          {showSettings && (
            <Button
              color="inherit"
              onClick={() => setShowSettings(false)}
              sx={{ mr: 1 }}
            >
              Back
            </Button>
          )}
          
          {/* User Menu */}
          <IconButton
            size="large"
            aria-label="account menu"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={handleProfileMenuClose}>
              <ListItemIcon>
                <AccountCircle fontSize="small" />
              </ListItemIcon>
              <ListItemText>
                <Typography variant="body2">{user?.username}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.email}
                </Typography>
              </ListItemText>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleShowSettings}>
              <ListItemIcon>
                <SettingsIcon fontSize="small" />
              </ListItemIcon>
              Settings
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <Logout fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Main Content Area */}
      <Box sx={{
        flex: 1,
        overflow: 'auto',
        pb: showSettings ? 2 : 8, // More space for bottom navigation
        px: 2,
        pt: 2,
        minHeight: 0 // Important for flex child to be scrollable
      }}>
        {renderCurrentTab()}
      </Box>

      {/* Bottom Navigation */}
      {!showSettings && (
        <BottomNavigation
          value={currentTab}
          onChange={(_, newValue) => setCurrentTab(newValue)}
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            zIndex: 1000,
          }}
        >
        <BottomNavigationAction
          label="Dashboard"
          value="dashboard"
          icon={<DashboardIcon />}
        />
        <BottomNavigationAction
          label="Voice"
          value="voice"
          icon={
            incomingCall ? (
              <Badge color="error" variant="dot">
                <Phone />
              </Badge>
            ) : (
              <Phone />
            )
          }
        />
        <BottomNavigationAction
          label="Messages"
          value="sms"
          icon={<Message />}
        />
        <BottomNavigationAction
          label="Chats"
          value="chats"
          icon={<ChatIcon />}
        />
        <BottomNavigationAction
          label="Recordings"
          value="recordings"
          icon={<RecordVoiceOver />}
        />
        </BottomNavigation>
      )}
    </Box>
  );
};

export default MobileApp;
