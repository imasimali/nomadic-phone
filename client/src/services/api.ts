import axios, { AxiosInstance } from 'axios'

// API Configuration
const API_BASE_URL = '/api'

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        const refreshToken = localStorage.getItem('refreshToken')
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          })

          const { accessToken, refreshToken: newRefreshToken } = response.data.tokens
          localStorage.setItem('accessToken', accessToken)
          localStorage.setItem('refreshToken', newRefreshToken)

          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          return api(originalRequest)
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.removeItem('accessToken')
        localStorage.removeItem('refreshToken')
        window.location.href = '/login'
      }
    }

    return Promise.reject(error)
  },
)

// API Types
export interface User {
  id: number
  username: string
  email: string
  phone_number?: string
  is_active: boolean
  last_login?: string
  twilio_client_name: string
  created_at: string
  updated_at: string
}

export interface Call {
  id: number
  call_sid: string
  from_number: string
  to_number: string
  direction: 'inbound' | 'outbound'
  status: string
  duration?: number
  start_time?: string
  end_time?: string
  recording_url?: string
  recording_sid?: string
  recording_duration?: number
  from_city?: string
  from_state?: string
  from_country?: string
  to_city?: string
  to_state?: string
  to_country?: string
  price?: number
  price_unit?: string
  answered_by?: string
  created_at: string
  updated_at: string
}

export interface SMS {
  id: number
  message_sid: string
  from_number: string
  to_number: string
  direction: 'inbound' | 'outbound'
  body: string
  status: string
  error_code?: number
  error_message?: string
  num_segments: number
  price?: number
  price_unit?: string
  from_city?: string
  from_state?: string
  from_country?: string
  to_city?: string
  to_state?: string
  to_country?: string
  media_urls?: string[]
  sent_at?: string
  delivered_at?: string
  created_at: string
  updated_at: string
}

export interface Conversation {
  phone_number: string
  last_message_at: string
  message_count: number
  last_message_body: string
  last_message_direction: 'inbound' | 'outbound'
}

export interface Recording {
  id: string
  recording_sid: string
  call_sid: string
  duration?: number
  recording_duration?: number
  status: string
  recording_url: string
  uri: string
  date_created: string
  date_updated: string
  created_at: string
  updated_at: string
  // Call details
  from_number: string
  to_number: string
  direction: 'inbound' | 'outbound' | 'unknown'
  call_status: string
  call_duration?: number
  start_time?: string
  end_time?: string
}

export interface VoiceSettings {
  incoming_call_action: 'recording' | 'client' | 'redirect'
  redirect_number?: string
  voice_language: string
  voice_message: string
}

export interface PaginationResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

// Auth API
export const authAPI = {
  login: (password: string) => api.post('/auth/login', { password }),

  logout: () => api.post('/auth/logout'),

  getProfile: () => api.get('/auth/profile'),
}

// Voice API
export const voiceAPI = {
  getToken: () => api.get('/voice/token'),

  getCalls: (params?: { page?: number; limit?: number; direction?: string; status?: string }) => api.get('/voice/calls', { params }),

  getCall: (callSid: string) => api.get(`/voice/calls/${callSid}`),

  getRecordings: (params?: { page?: number; limit?: number }) => api.get('/voice/recordings', { params }),

  getSettings: () => api.get('/voice/settings'),

  updateSettings: (settings: Partial<VoiceSettings>) => api.put('/voice/settings', settings),
}

// SMS API
export const smsAPI = {
  sendSMS: (to: string, body: string, mediaUrls?: string[]) => api.post('/sms/send', { to, body, mediaUrls }),

  getMessages: (params?: { page?: number; limit?: number; direction?: string; status?: string }) => api.get('/sms/messages', { params }),

  getMessage: (messageSid: string) => api.get(`/sms/messages/${messageSid}`),

  getConversation: (phoneNumber: string, params?: { page?: number; limit?: number }) => api.get(`/sms/conversations/${encodeURIComponent(phoneNumber)}`, { params }),

  getConversations: () => api.get('/sms/conversations'),

  deleteMessage: (messageSid: string) => api.delete(`/sms/messages/${messageSid}`),
}

export default api
