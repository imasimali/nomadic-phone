import twilio, { Twilio } from 'twilio'
import config from '../config.js'
import {
  Call,
  CallsResponse,
  Recording,
  RecordingsResponse,
  Message,
  MessagesResponse,
  SendSMSResponse,
} from '../types/index.js'

interface GetCallsOptions {
  limit?: number
  direction?: 'inbound' | 'outbound'
}

interface GetRecordingsOptions {
  limit?: number
}

interface GetMessagesOptions {
  limit?: number
  direction?: 'inbound' | 'outbound'
}

interface GetConversationOptions {
  limit?: number
}

interface ConversationData {
  phoneNumber: string
  lastMessage: string
  lastMessageTime: Date
  direction: 'inbound' | 'outbound'
}

class TwilioService {
  private client: Twilio | null
  private phoneNumber: string | undefined

  constructor() {
    if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN) {
      console.warn('Twilio credentials not found in configuration')
      this.client = null
      this.phoneNumber = undefined
      return
    }

    this.client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
    this.phoneNumber = config.TWILIO_PHONE_NUMBER
  }

  // Call-related methods
  async getCalls(options: GetCallsOptions = {}): Promise<CallsResponse> {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    const { limit = 20, direction } = options
    const requestedLimit = Math.min(limit, 1000)

    try {
      // Fetch more than needed to account for filtering and deduplication
      const fetchLimit = Math.min(requestedLimit * 2, 1000)
      const twilioOptions: any = {
        limit: fetchLimit,
      }

      // Add filters if provided
      if (this.phoneNumber) {
        if (direction === 'inbound') {
          twilioOptions.to = this.phoneNumber
        } else if (direction === 'outbound') {
          twilioOptions.from = this.phoneNumber
        }
      }

      const calls = await this.client.calls.list(twilioOptions)

      // Simple transformation
      const transformedCalls: Call[] = calls.map((call) => ({
        id: call.sid,
        call_sid: call.sid,
        from_number: call.from,
        to_number: call.to,
        direction: call.direction as 'inbound' | 'outbound',
        status: call.status,
        duration: call.duration ? parseInt(call.duration.toString()) : undefined,
        start_time: call.startTime,
        end_time: call.endTime,
        created_at: call.dateCreated,
        updated_at: call.dateUpdated,
      }))

      // Sort by creation date (newest first)
      transformedCalls.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      // Apply the requested limit
      const limitedCalls = transformedCalls.slice(0, requestedLimit)

      return {
        calls: limitedCalls,
        pagination: {
          page: 1,
          limit: requestedLimit,
          total: transformedCalls.length, // Total fetched, not total available
          pages: Math.ceil(transformedCalls.length / requestedLimit),
        },
      }
    } catch (error: any) {
      console.error('Error fetching calls from Twilio:', error)
      throw new Error(`Failed to fetch calls: ${error.message}`)
    }
  }

  async getCall(callSid: string): Promise<Call> {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    try {
      const call = await this.client.calls(callSid).fetch()

      return {
        id: call.sid,
        call_sid: call.sid,
        from_number: call.from,
        to_number: call.to,
        direction: call.direction as 'inbound' | 'outbound',
        status: call.status,
        duration: call.duration ? parseInt(call.duration.toString()) : undefined,
        start_time: call.startTime,
        end_time: call.endTime,
        created_at: call.dateCreated,
        updated_at: call.dateUpdated,
      }
    } catch (error: any) {
      console.error('Error fetching call from Twilio:', error)
      throw new Error(`Failed to fetch call: ${error.message}`)
    }
  }

  // Get all recordings
  async getRecordings(options: GetRecordingsOptions = {}): Promise<RecordingsResponse> {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    const { limit = 20 } = options

    try {
      const twilioOptions = { limit: Math.min(limit, 1000) }

      const recordings = await this.client.recordings.list(twilioOptions)

      // For each recording, fetch the associated call details
      const recordingsWithCallDetails = await Promise.all(
        recordings.map(async (recording) => {
          try {
            // Fetch call details for this recording
            const call = await this.client!.calls(recording.callSid).fetch()

            return {
              id: recording.sid,
              recording_sid: recording.sid,
              call_sid: recording.callSid,
              duration: recording.duration ? parseInt(recording.duration.toString()) : 0,
              recording_url: `/api/voice/recordings/${recording.sid}`,
              created_at: recording.dateCreated,
              updated_at: recording.dateUpdated,
              // Call details
              from_number: call.from,
              to_number: call.to,
              direction: call.direction as 'inbound' | 'outbound',
              call_status: call.status,
              call_duration: call.duration ? parseInt(call.duration.toString()) : undefined,
              start_time: call.startTime,
              end_time: call.endTime,
            } as Recording
          } catch (callError: any) {
            console.warn(`Could not fetch call details for recording ${recording.sid}:`, callError.message)
            // Return recording without call details if call fetch fails
            return {
              id: recording.sid,
              recording_sid: recording.sid,
              call_sid: recording.callSid,
              duration: recording.duration ? parseInt(recording.duration.toString()) : 0,
              recording_url: `/api/voice/recordings/${recording.sid}`,
              created_at: recording.dateCreated,
              updated_at: recording.dateUpdated,
              // Default values when call details are unavailable
              from_number: 'Unknown',
              to_number: 'Unknown',
              direction: 'inbound' as const,
              call_status: 'unknown',
              call_duration: undefined,
              start_time: undefined,
              end_time: undefined,
            } as Recording
          }
        })
      )

      // Sort by creation date (newest first)
      recordingsWithCallDetails.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      return {
        recordings: recordingsWithCallDetails,
        pagination: {
          page: 1,
          limit: recordingsWithCallDetails.length,
          total: recordingsWithCallDetails.length,
          pages: 1,
        },
      }
    } catch (error: any) {
      console.error('Error fetching recordings from Twilio:', error)
      throw new Error(`Failed to fetch recordings: ${error.message}`)
    }
  }

  // Get a specific recording
  async getRecording(recordingSid: string): Promise<any> {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    try {
      const recording = await this.client.recordings(recordingSid).fetch()

      return {
        sid: recording.sid,
        call_sid: recording.callSid,
        duration: recording.duration ? parseInt(recording.duration.toString()) : 0,
        status: recording.status,
        uri: recording.uri,
        date_created: recording.dateCreated,
        date_updated: recording.dateUpdated,
      }
    } catch (error: any) {
      console.error('Error fetching recording from Twilio:', error)
      throw new Error(`Failed to fetch recording: ${error.message}`)
    }
  }

  // SMS-related methods
  async getMessages(options: GetMessagesOptions = {}): Promise<MessagesResponse> {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    const { limit = 20, direction } = options
    const requestedLimit = Math.min(limit, 1000)

    try {
      // Fetch more than needed to account for filtering and deduplication
      const fetchLimit = Math.min(requestedLimit * 2, 1000)
      const twilioOptions: any = {
        limit: fetchLimit,
      }

      // Always filter by our phone number to ensure we only get messages to/from our number
      if (this.phoneNumber) {
        if (direction === 'inbound') {
          twilioOptions.to = this.phoneNumber
        } else if (direction === 'outbound') {
          twilioOptions.from = this.phoneNumber
        } else {
          // When no direction is specified, we need to get both inbound and outbound
          // We'll fetch both and combine them
        }
      }

      let messages: any[]
      if (!direction && this.phoneNumber) {
        // Fetch both inbound and outbound messages separately
        const [inboundMessages, outboundMessages] = await Promise.all([
          this.client.messages.list({ ...twilioOptions, to: this.phoneNumber }),
          this.client.messages.list({ ...twilioOptions, from: this.phoneNumber }),
        ])
        messages = [...inboundMessages, ...outboundMessages]
      } else {
        messages = await this.client.messages.list(twilioOptions)
      }

      // Transform messages and ensure correct direction
      const transformedMessages: Message[] = messages.map((message) => {
        // Determine direction based on our phone number
        let messageDirection: 'inbound' | 'outbound' = message.direction
        if (this.phoneNumber) {
          if (message.from === this.phoneNumber) {
            messageDirection = 'outbound'
          } else if (message.to === this.phoneNumber) {
            messageDirection = 'inbound'
          }
        }

        return {
          id: message.sid,
          message_sid: message.sid,
          from_number: message.from,
          to_number: message.to,
          direction: messageDirection,
          body: message.body,
          status: message.status,
          created_at: message.dateCreated,
          updated_at: message.dateUpdated,
        }
      })

      // Remove duplicates (in case a message appears in both inbound and outbound lists)
      const uniqueMessages = transformedMessages.reduce((acc: Message[], message) => {
        if (!acc.find((m) => m.message_sid === message.message_sid)) {
          acc.push(message)
        }
        return acc
      }, [])

      // Sort by creation date (newest first)
      uniqueMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      // Apply the requested limit to the final result
      const limitedMessages = uniqueMessages.slice(0, requestedLimit)

      return {
        messages: limitedMessages,
        pagination: {
          page: 1,
          limit: requestedLimit,
          total: uniqueMessages.length, // Total fetched, not total available
          pages: Math.ceil(uniqueMessages.length / requestedLimit),
        },
      }
    } catch (error: any) {
      console.error('Error fetching messages from Twilio:', error)
      throw new Error(`Failed to fetch messages: ${error.message}`)
    }
  }

  // Get conversation with a specific phone number
  async getConversation(phoneNumber: string, options: GetConversationOptions = {}): Promise<MessagesResponse> {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    const { limit = 50 } = options

    try {
      // Get messages to and from the specific phone number
      const [inboundMessages, outboundMessages] = await Promise.all([
        this.client.messages.list({
          to: this.phoneNumber,
          from: phoneNumber,
          limit: Math.min(limit, 1000),
        }),
        this.client.messages.list({
          from: this.phoneNumber,
          to: phoneNumber,
          limit: Math.min(limit, 1000),
        }),
      ])

      const allMessages = [...inboundMessages, ...outboundMessages]

      // Transform messages
      const transformedMessages: Message[] = allMessages.map((message) => ({
        id: message.sid,
        message_sid: message.sid,
        from_number: message.from,
        to_number: message.to,
        direction: message.from === this.phoneNumber ? 'outbound' : 'inbound',
        body: message.body,
        status: message.status,
        created_at: message.dateCreated,
        updated_at: message.dateUpdated,
      }))

      // Sort by creation date (oldest first for conversation view)
      transformedMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      // Apply limit
      const limitedMessages = transformedMessages.slice(0, limit)

      return {
        messages: limitedMessages,
        pagination: {
          page: 1,
          limit: limit,
          total: limitedMessages.length,
          pages: 1,
        },
      }
    } catch (error: any) {
      console.error('Error fetching conversation from Twilio:', error)
      throw new Error(`Failed to fetch conversation: ${error.message}`)
    }
  }

  // Get list of conversations (unique phone numbers with latest message)
  async getConversations(): Promise<ConversationData[]> {
    try {
      // Fetch recent messages to build conversation list
      const messages = await this.getMessages({ limit: 100 })

      const conversationMap = new Map<string, ConversationData>()

      messages.messages.forEach((message) => {
        const otherNumber = message.direction === 'outbound' ? message.to_number : message.from_number

        if (!conversationMap.has(otherNumber)) {
          conversationMap.set(otherNumber, {
            phoneNumber: otherNumber,
            lastMessage: message.body,
            lastMessageTime: message.created_at,
            direction: message.direction,
          })
        } else {
          const existing = conversationMap.get(otherNumber)!
          if (new Date(message.created_at).getTime() > new Date(existing.lastMessageTime).getTime()) {
            existing.lastMessage = message.body
            existing.lastMessageTime = message.created_at
            existing.direction = message.direction
          }
        }
      })

      const conversations = Array.from(conversationMap.values())
      conversations.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())

      return conversations
    } catch (error: any) {
      console.error('Error fetching conversations from Twilio:', error)
      throw new Error(`Failed to fetch conversations: ${error.message}`)
    }
  }

  // Get a specific message
  async getMessage(messageSid: string): Promise<Message> {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    try {
      const message = await this.client.messages(messageSid).fetch()

      return {
        id: message.sid,
        message_sid: message.sid,
        from_number: message.from,
        to_number: message.to,
        direction: message.from === this.phoneNumber ? 'outbound' : 'inbound',
        body: message.body,
        status: message.status,
        created_at: message.dateCreated,
        updated_at: message.dateUpdated,
      }
    } catch (error: any) {
      console.error('Error fetching message from Twilio:', error)
      throw new Error(`Failed to fetch message: ${error.message}`)
    }
  }

  // Send SMS
  async sendSMS(to: string, body: string, mediaUrls: string[] | null = null): Promise<SendSMSResponse> {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    if (!this.phoneNumber) {
      throw new Error('Twilio phone number not configured')
    }

    try {
      const messageData: any = {
        to,
        from: this.phoneNumber,
        body,
      }

      if (mediaUrls && mediaUrls.length > 0) {
        messageData.mediaUrl = mediaUrls
      }

      const message = await this.client.messages.create(messageData)

      return {
        messageSid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        body: message.body,
      }
    } catch (error: any) {
      console.error('Error sending SMS:', error)
      throw new Error(`Failed to send SMS: ${error.message}`)
    }
  }
}

// Create singleton instance
const twilioService = new TwilioService()

export default twilioService
