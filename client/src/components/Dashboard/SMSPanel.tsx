import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  IconButton,
  Badge,
  CircularProgress,
} from '@mui/material';
import {
  Message,
  Send,
  Person,
  Refresh,
  Delete,
  Close,
} from '@mui/icons-material';
import { smsAPI, Conversation, SMS } from '../../services/api';
import LoadingScreen from '../Common/LoadingScreen';

const SMSPanel: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<SMS[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNewConversation, setShowNewConversation] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation);
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    try {
      setConversationsLoading(true);
      const response = await smsAPI.getConversations();
      setConversations(response.data.conversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      setError('Failed to load conversations');
    } finally {
      setConversationsLoading(false);
    }
  };

  const loadMessages = async (phoneNumber: string) => {
    try {
      setLoading(true);
      const response = await smsAPI.getConversation(phoneNumber);
      setMessages(response.data.messages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const phoneNumber = selectedConversation || newPhoneNumber;
    if (!phoneNumber) {
      setError('Please select a conversation or enter a phone number');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      await smsAPI.sendSMS(phoneNumber, newMessage.trim());
      setNewMessage('');
      
      // Refresh messages and conversations
      await loadMessages(phoneNumber);
      await loadConversations();
      
      // If this was a new conversation, select it
      if (!selectedConversation) {
        setSelectedConversation(phoneNumber);
        setShowNewConversation(false);
        setNewPhoneNumber('');
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatPhoneNumber = (phoneNumber: string) => {
    if (phoneNumber.startsWith('+1') && phoneNumber.length === 12) {
      return `+1 (${phoneNumber.slice(2, 5)}) ${phoneNumber.slice(5, 8)}-${phoneNumber.slice(8)}`;
    }
    return phoneNumber;
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
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  const getInitials = (phoneNumber: string) => {
    return phoneNumber.slice(-2);
  };

  const startNewConversation = () => {
    setSelectedConversation(null);
    setMessages([]);
    setShowNewConversation(true);
    setNewPhoneNumber('');
    setNewMessage('');
  };

  if (conversationsLoading) {
    return <LoadingScreen message="Loading conversations..." />;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Messages
      </Typography>

      <Grid container spacing={3} sx={{
        height: { xs: 'auto', md: 'calc(100vh - 200px)' },
        minHeight: { xs: '70vh', md: 'calc(100vh - 200px)' }
      }}>
        {/* Conversations List */}
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ pb: 1 }}>
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
                gap: { xs: 1, sm: 0 }
              }}>
                <Typography variant="h6" sx={{ flexShrink: 0 }}>Conversations</Typography>
                <Box sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center'
                }}>
                  <IconButton
                    onClick={loadConversations}
                    size="small"
                    sx={{
                      minWidth: { xs: 44, sm: 'auto' },
                      minHeight: { xs: 44, sm: 'auto' }
                    }}
                  >
                    <Refresh />
                  </IconButton>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Message />}
                    onClick={startNewConversation}
                    sx={{
                      minHeight: { xs: 44, sm: 'auto' },
                      fontSize: { xs: '0.875rem', sm: '0.8125rem' }
                    }}
                  >
                    New
                  </Button>
                </Box>
              </Box>
            </CardContent>
            
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
              {conversations.length === 0 ? (
                <Box sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    No conversations yet. Start by sending a message!
                  </Typography>
                </Box>
              ) : (
                <List dense>
                  {conversations.map((conversation) => (
                    <ListItem key={conversation.phone_number} disablePadding>
                      <ListItemButton
                        selected={selectedConversation === conversation.phone_number}
                        onClick={() => setSelectedConversation(conversation.phone_number)}
                      >
                      <ListItemAvatar>
                        <Avatar>
                          {getInitials(conversation.phone_number)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={formatPhoneNumber(conversation.phone_number)}
                        secondary={
                          <>
                            <Typography variant="body2" noWrap component="span" display="block">
                              {conversation.last_message_direction === 'outbound' ? 'You: ' : ''}
                              {conversation.last_message_body}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" component="span" display="block">
                              {formatDate(conversation.last_message_at)}
                            </Typography>
                          </>
                        }
                      />
                        {conversation.message_count > 0 && (
                          <Badge badgeContent={conversation.message_count} color="primary" />
                        )}
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Messages View */}
        <Grid item xs={12} md={8}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {selectedConversation || showNewConversation ? (
              <>
                {/* Header */}
                <CardContent sx={{ pb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">
                      {selectedConversation 
                        ? formatPhoneNumber(selectedConversation)
                        : 'New Message'
                      }
                    </Typography>
                    <IconButton 
                      onClick={() => {
                        setSelectedConversation(null);
                        setShowNewConversation(false);
                        setMessages([]);
                      }}
                    >
                      <Close />
                    </IconButton>
                  </Box>
                </CardContent>

                <Divider />

                {/* Messages */}
                <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                  {showNewConversation && !selectedConversation && (
                    <TextField
                      fullWidth
                      label="Phone Number"
                      value={newPhoneNumber}
                      onChange={(e) => setNewPhoneNumber(e.target.value)}
                      placeholder="+1 (555) 123-4567"
                      sx={{ mb: 2 }}
                    />
                  )}

                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : messages.length === 0 && selectedConversation ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No messages in this conversation yet.
                      </Typography>
                    </Box>
                  ) : (
                    <List>
                      {messages.map((message) => (
                        <ListItem
                          key={message.id}
                          sx={{
                            flexDirection: 'column',
                            alignItems: message.direction === 'outbound' ? 'flex-end' : 'flex-start',
                            mb: 1,
                          }}
                        >
                          <Box
                            sx={{
                              maxWidth: '70%',
                              p: 1.5,
                              borderRadius: 2,
                              backgroundColor: message.direction === 'outbound' 
                                ? 'primary.main' 
                                : 'grey.200',
                              color: message.direction === 'outbound' 
                                ? 'primary.contrastText' 
                                : 'text.primary',
                            }}
                          >
                            <Typography variant="body1">
                              {message.body}
                            </Typography>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(message.created_at)}
                            </Typography>
                            {message.direction === 'outbound' && (
                              <Chip
                                label={message.status}
                                size="small"
                                variant="outlined"
                                sx={{ ml: 1, height: 20 }}
                              />
                            )}
                          </Box>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>

                <Divider />

                {/* Message Input */}
                <CardContent>
                  {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {error}
                    </Alert>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      fullWidth
                      multiline
                      maxRows={3}
                      placeholder="Type your message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={loading}
                    />
                    <Button
                      variant="contained"
                      endIcon={<Send />}
                      onClick={sendMessage}
                      disabled={loading || !newMessage.trim() || (!selectedConversation && !newPhoneNumber.trim())}
                      sx={{ minWidth: 100 }}
                    >
                      Send
                    </Button>
                  </Box>
                  
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Press Enter to send, Shift+Enter for new line
                  </Typography>
                </CardContent>
              </>
            ) : (
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '100%',
                p: 4 
              }}>
                <Message sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Select a conversation
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Choose a conversation from the list or start a new one
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Message />}
                  onClick={startNewConversation}
                >
                  Start New Conversation
                </Button>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SMSPanel;
