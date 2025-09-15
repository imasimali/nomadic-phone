import { Request } from 'express'

// User and Authentication Types
export interface User {
  id: number
  username: string
  email?: string
  twilio_client_name: string
}

export interface AuthenticatedRequest extends Request {
  user?: User
}

export interface LoginRequest {
  password: string
}

export interface LoginResponse {
  message: string
  user: User
  tokens: {
    accessToken: string
    refreshToken: string
  }
}

export interface RefreshTokenRequest {
  refreshToken: string
}

// Call Types
export interface Call {
  id: string
  call_sid: string
  from_number: string
  to_number: string
  direction: 'inbound' | 'outbound'
  status: string
  duration?: number
  start_time?: Date
  end_time?: Date
  created_at: Date
  updated_at: Date
}

export interface CallsResponse {
  calls: Call[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// Recording Types
export interface Recording {
  id: string
  recording_sid: string
  call_sid: string
  duration: number
  url: string
  created_at: Date
  updated_at: Date
  // Call details
  from_number: string
  to_number: string
  direction: 'inbound' | 'outbound'
  call_status: string
  call_duration?: number
  start_time?: Date
  end_time?: Date
}

export interface RecordingsResponse {
  recordings: Recording[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// Message Types
export interface Message {
  id: string
  message_sid: string
  from_number: string
  to_number: string
  direction: 'inbound' | 'outbound'
  body: string
  status: string
  created_at: Date
  updated_at: Date
  media_urls?: string[]
}

export interface MessagesResponse {
  messages: Message[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface Conversation {
  phone_number: string
  last_message: Message
  unread_count: number
  message_count: number
}

export interface ConversationsResponse {
  conversations: Conversation[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface SendSMSRequest {
  to: string
  body: string
  mediaUrls?: string[]
}

export interface SendSMSResponse {
  messageSid: string
  status: string
  to: string
  from: string
  body: string
}

// Voice Settings Types
export interface VoiceSettings {
  redirect_number?: string
  voice_message?: string
}

// API Key Types
export interface ApiKey {
  sid: string
  secret: string
}

// Twilio Webhook Types
export interface TwilioVoiceWebhook {
  CallSid: string
  From: string
  To: string
  Direction?: string
  CallStatus?: string
  RecordingUrl?: string
  RecordingSid?: string
  RecordingDuration?: string
}

export interface TwilioSMSWebhook {
  MessageSid: string
  From: string
  To: string
  Body: string
  NumMedia?: string
  [key: `MediaUrl${number}`]: string
}

// Configuration Types
export interface Config {
  TWILIO_ACCOUNT_SID?: string
  TWILIO_AUTH_TOKEN?: string
  TWILIO_PHONE_NUMBER?: string
  TWILIO_APPLICATION_SID?: string
  PORT: number
  NODE_ENV: string
  JWT_SECRET?: string
  JWT_REFRESH_SECRET?: string
  APP_PASSWORD?: string
  APP_URL?: string
  WEBHOOK_BASE_URL?: string
  NOMADIC_API_KEY_SID?: string
  NOMADIC_API_SECRET?: string
  REDIRECT_NUMBER?: string
  VOICE_MESSAGE?: string
  VOICE_MISSING_RECORD?: string
  PUSHOVER_USER_KEY?: string
  PUSHOVER_API_TOKEN?: string
}

// Error Types
export interface AppError extends Error {
  statusCode: number
  code: string
  isOperational: boolean
}

// Pushover Types
export interface PushoverNotificationOptions {
  message: string
  title?: string
  priority?: string
  sound?: string
  url?: string
  urlTitle?: string
}

export interface PushoverResponse {
  success: boolean
  data?: any
  error?: string | string[]
}
