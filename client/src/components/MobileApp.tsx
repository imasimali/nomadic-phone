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
} from '@mui/material';
import {
  Phone,
  Message,
  History,
  AccountCircle,
  Logout,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useVoice } from '../contexts/VoiceContext';
import VoicePanel from './Dashboard/VoicePanel';
import SMSPanel from './Dashboard/SMSPanel';
import CallHistory from './Dashboard/CallHistory';

type TabValue = 'voice' | 'sms' | 'history';

const MobileApp: React.FC = () => {
  const { user, logout } = useAuth();
  const { incomingCall } = useVoice();
  const [currentTab, setCurrentTab] = useState<TabValue>('voice');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

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

  const renderCurrentTab = () => {
    switch (currentTab) {
      case 'voice':
        return <VoicePanel />;
      case 'sms':
        return <SMSPanel />;
      case 'history':
        return <CallHistory />;
      default:
        return <VoicePanel />;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top App Bar */}
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Nomadic Phone
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
        pb: 7, // Space for bottom navigation
        px: 2,
        pt: 2
      }}>
        {renderCurrentTab()}
      </Box>

      {/* Bottom Navigation */}
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
          label="History"
          value="history"
          icon={<History />}
        />
      </BottomNavigation>
    </Box>
  );
};

export default MobileApp;
