import React, { useState } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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
import Voice from './Dashboard/Voice';
import SMS from './Dashboard/SMS';
import Chat from './Dashboard/Chat';
import Recordings from './Dashboard/Recordings';
import Settings from './Dashboard/Settings';
import Home from './Dashboard/Home';

type TabValue = 'dashboard' | 'voice' | 'sms' | 'chats' | 'recordings';

const MobileApp: React.FC = () => {
  const { user, logout } = useAuth();
  const { incomingCall } = useVoice();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  // Get current tab from URL
  const getCurrentTab = (): TabValue => {
    const path = location.pathname;
    if (path === '/voice') return 'voice';
    if (path === '/sms') return 'sms';
    if (path === '/chats') return 'chats';
    if (path === '/recordings') return 'recordings';
    return 'dashboard';
  };

  const isSettingsPage = location.pathname === '/settings';

  const currentTab = getCurrentTab();

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
    navigate('/settings');
    handleProfileMenuClose();
  };

  const handleTabChange = (tab: string) => {
    if (tab === 'dashboard') {
      navigate('/');
    } else {
      navigate(`/${tab}`);
    }
  };

  const renderCurrentTab = () => {
    return (
      <Routes>
        <Route path="/" element={<Home onNavigateToTab={handleTabChange} />} />
        <Route path="voice" element={<Voice />} />
        <Route path="sms" element={<SMS />} />
        <Route path="chats" element={<Chat />} />
        <Route path="recordings" element={<Recordings />} />
        <Route path="settings" element={<Settings />} />
      </Routes>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top App Bar */}
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {isSettingsPage ? 'Settings' :
             currentTab === 'dashboard' ? 'Dashboard' :
             currentTab === 'voice' ? 'Voice' :
             currentTab === 'sms' ? 'Messages' :
             currentTab === 'chats' ? 'Chats' :
             currentTab === 'recordings' ? 'Recordings' :
             'Nomadic Phone'}
          </Typography>
          
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
        pb: 8, // Space for bottom navigation
        px: 2,
        pt: 2,
        minHeight: 0 // Important for flex child to be scrollable
      }}>
        {renderCurrentTab()}
      </Box>

      {/* Bottom Navigation */}
      <BottomNavigation
          value={currentTab}
          onChange={(_, newValue) => {
            if (newValue === 'dashboard') {
              navigate('/');
            } else {
              navigate(`/${newValue}`);
            }
          }}
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
    </Box>
  );
};

export default MobileApp;
