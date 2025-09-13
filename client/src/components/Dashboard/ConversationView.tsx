import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Paper,
  IconButton,
  AppBar,
  Toolbar,
} from '@mui/material';
import {
  Send,
  ArrowBack,
  Refresh,
} from '@mui/icons-material';
import { smsAPI, SMS } from '../../services/api';

interface ConversationViewProps {
  phoneNumber: string;
  onBack: () => void;
}

const ConversationView: React.FC<ConversationViewProps> = ({ phoneNumber, onBack }) => {
  const [messages, setMessages] = useState<SMS[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
  }, [phoneNumber]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get all messages and filter by phone number
      const response = await smsAPI.getMessages({ limit: 100 });
      const allMessages = response.data.messages || [];
      
      // Filter messages for this conversation
      const conversationMessages = allMessages.filter((msg: SMS) => {
        const otherNumber = msg.direction === 'outbound' ? msg.to_number : msg.from_number;
        return otherNumber === phoneNumber;
      });

      // Sort by date (oldest first for conversation view)
      conversationMessages.sort((a: SMS, b: SMS) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      setMessages(conversationMessages);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      setSending(true);
      setError('');

      await smsAPI.sendSMS(phoneNumber, newMessage.trim());

      setNewMessage('');
      // Reload messages to show the sent message
      await loadMessages();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatPhoneNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return number;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { [key: string]: SMS[] }, message) => {
    const dateKey = formatDate(message.created_at);
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(message);
    return groups;
  }, {});

  return (
    <Box sx={{
      height: 'calc(100vh - 120px)', // Account for main app header (64px) + bottom nav (56px)
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* Header */}
      <AppBar position="static" color="default" elevation={1} sx={{ flexShrink: 0 }}>
        <Toolbar>
          <IconButton edge="start" onClick={onBack} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            {formatPhoneNumber(phoneNumber)}
          </Typography>
          <IconButton onClick={loadMessages} disabled={loading}>
            <Refresh />
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ m: 2, flexShrink: 0 }}>
          {error}
        </Alert>
      )}

      {/* Messages */}
      <Box sx={{
        flex: 1,
        overflow: 'auto',
        p: 1,
        minHeight: 0 // Important for flex child to be scrollable
      }}>
        {loading ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">Loading messages...</Typography>
          </Box>
        ) : messages.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">No messages yet</Typography>
            <Typography variant="body2" color="text.secondary">
              Start the conversation by sending a message below
            </Typography>
          </Box>
        ) : (
          Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <Box key={date}>
              {/* Date separator */}
              <Box sx={{ textAlign: 'center', my: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ 
                  bgcolor: 'background.paper', 
                  px: 2, 
                  py: 0.5, 
                  borderRadius: 1,
                  border: 1,
                  borderColor: 'divider'
                }}>
                  {date}
                </Typography>
              </Box>

              {/* Messages for this date */}
              {dateMessages.map((message) => (
                <Box
                  key={message.id}
                  sx={{
                    display: 'flex',
                    justifyContent: message.direction === 'outbound' ? 'flex-end' : 'flex-start',
                    mb: 1,
                  }}
                >
                  <Paper
                    sx={{
                      maxWidth: '70%',
                      p: 1.5,
                      bgcolor: message.direction === 'outbound' ? 'primary.main' : 'grey.100',
                      color: message.direction === 'outbound' ? 'primary.contrastText' : 'text.primary',
                      borderRadius: 2,
                      borderTopRightRadius: message.direction === 'outbound' ? 0.5 : 2,
                      borderTopLeftRadius: message.direction === 'inbound' ? 0.5 : 2,
                    }}
                  >
                    <Typography variant="body2">
                      {message.body}
                    </Typography>
                    <Typography 
                      variant="caption" 
                      sx={{ 
                        opacity: 0.7, 
                        display: 'block', 
                        textAlign: 'right', 
                        mt: 0.5 
                      }}
                    >
                      {formatTime(message.created_at)}
                    </Typography>
                  </Paper>
                </Box>
              ))}
            </Box>
          ))
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Message Input */}
      <Paper sx={{
        p: 2,
        borderRadius: 0,
        flexShrink: 0,
        borderTop: 1,
        borderColor: 'divider'
      }} elevation={3}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={3}
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={sending}
          />
          <Button
            variant="contained"
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            sx={{ minWidth: 56, height: 56 }}
          >
            <Send />
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default ConversationView;
