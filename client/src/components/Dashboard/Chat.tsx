import React, { useState, useEffect } from 'react'
import { Box, Card, CardContent, Typography, List, ListItem, ListItemIcon, ListItemText, Alert, Avatar, Chip, IconButton, Tooltip, Button } from '@mui/material'
import { Message, Refresh, Send } from '@mui/icons-material'
import { smsAPI, SMS } from '../../services/api'
import Conversation from './Conversation'
import SMSModal from './SMSModal'
import { usePageTitle } from '../../hooks/usePageTitle'

interface ChatConversation {
  phoneNumber: string
  lastMessage: string
  lastMessageTime: string
  messageCount: number
  direction: 'inbound' | 'outbound'
}

const Chat: React.FC = () => {
  usePageTitle('Chats')

  const [conversations, setConversations] = useState<ChatConversation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [smsModalOpen, setSmsModalOpen] = useState(false)

  useEffect(() => {
    loadConversations()
  }, [])

  const loadConversations = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await smsAPI.getMessages({ limit: 100 })

      // Group messages by phone number to create conversations
      const conversationMap = new Map<string, ChatConversation>()

      ;(response.data.messages || []).forEach((message: SMS) => {
        const otherNumber = message.direction.startsWith('outbound') ? message.to_number : message.from_number

        if (!conversationMap.has(otherNumber)) {
          conversationMap.set(otherNumber, {
            phoneNumber: otherNumber,
            lastMessage: message.body,
            lastMessageTime: message.created_at,
            messageCount: 1,
            direction: message.direction,
          })
        } else {
          const existing = conversationMap.get(otherNumber)!
          // Update if this message is more recent
          if (new Date(message.created_at) > new Date(existing.lastMessageTime)) {
            existing.lastMessage = message.body
            existing.lastMessageTime = message.created_at
            existing.direction = message.direction
          }
          existing.messageCount += 1
        }
      })

      // Convert to array and sort by most recent
      const conversationList = Array.from(conversationMap.values()).sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())

      setConversations(conversationList)
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }

  const formatPhoneNumber = (number: string) => {
    const cleaned = number.replace(/\D/g, '')
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return number
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else if (diffInHours < 168) {
      // 7 days
      return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
    }
  }

  const truncateMessage = (message: string, maxLength: number = 50) => {
    if (message.length <= maxLength) return message
    return message.substring(0, maxLength) + '...'
  }

  // Show individual conversation if selected
  if (selectedConversation) {
    return <Conversation phoneNumber={selectedConversation} onBack={() => setSelectedConversation(null)} />
  }

  return (
    <Box sx={{ pb: 2 }}>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Conversations</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            variant="contained"
            startIcon={<Send />}
            onClick={() => setSmsModalOpen(true)}
            size="small"
            sx={{
              minHeight: 32,
              fontSize: '0.8rem',
              px: 2,
              py: 0.5,
            }}
          >
            New Message
          </Button>
          <Tooltip title="Refresh">
            <IconButton
              onClick={loadConversations}
              disabled={loading}
              sx={{
                border: 1,
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': { bgcolor: 'primary.light', opacity: 0.1 },
                width: 32,
                height: 32,
              }}
            >
              <Refresh sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Conversations List */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">Loading conversations...</Typography>
            </Box>
          ) : conversations.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Message sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography color="text.secondary" variant="h6" gutterBottom>
                No conversations yet
              </Typography>
              <Typography color="text.secondary" variant="body2">
                Start a conversation by sending a message
              </Typography>
            </Box>
          ) : (
            <List>
              {conversations.map((conversation, index) => (
                <ListItem
                  key={conversation.phoneNumber}
                  divider={index < conversations.length - 1}
                  sx={{ py: 2, cursor: 'pointer' }}
                  onClick={() => setSelectedConversation(conversation.phoneNumber)}
                >
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <Message />
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle1" fontWeight="medium" component="span">
                          {formatPhoneNumber(conversation.phoneNumber)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip size="small" label={conversation.messageCount} color="primary" variant="outlined" />
                          <Typography variant="caption" color="text.secondary" component="span">
                            {formatTime(conversation.lastMessageTime)}
                          </Typography>
                        </Box>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }} component="span">
                        {conversation.direction.startsWith('outbound') ? (
                          <Send sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                        ) : (
                          <Message sx={{ fontSize: 14, mr: 0.5, color: 'text.secondary' }} />
                        )}
                        <Typography variant="body2" color="text.secondary" component="span">
                          {truncateMessage(conversation.lastMessage)}
                        </Typography>
                      </Box>
                    }
                    primaryTypographyProps={{ component: 'div' }}
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* SMS Modal */}
      <SMSModal open={smsModalOpen} onClose={() => setSmsModalOpen(false)} onMessageSent={loadConversations} />
    </Box>
  )
}

export default Chat
