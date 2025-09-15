import axios from 'axios'
import config from '../config.js'
import { PushoverNotificationOptions, PushoverResponse } from '../types/index.js'

class PushoverService {
  private readonly apiUrl: string
  private readonly userKey: string | undefined
  private readonly apiToken: string | undefined
  private readonly enabled: boolean

  constructor() {
    this.apiUrl = 'https://api.pushover.net/1/messages.json'
    this.userKey = config.PUSHOVER_USER_KEY
    this.apiToken = config.PUSHOVER_API_TOKEN
    this.enabled = !!(this.userKey && this.apiToken)

    if (!this.enabled) {
      console.warn('Pushover service disabled: Missing PUSHOVER_USER_KEY or PUSHOVER_API_TOKEN')
    } else {
      console.log('Pushover service initialized successfully')
    }
  }

  /**
   * Check if the service is enabled and configured
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Send a notification via Pushover
   */
  async sendNotification(options: PushoverNotificationOptions): Promise<PushoverResponse> {
    if (!this.enabled) {
      console.warn('Pushover service is not enabled - skipping notification')
      return { success: false, error: 'Service not configured' }
    }

    if (!this.apiToken || !this.userKey) {
      return { success: false, error: 'Missing API token or user key' }
    }

    const { message, title = 'Nomadic Phone', priority = '0', sound = 'pushover', url, urlTitle } = options

    if (!message) {
      throw new Error('Message is required for Pushover notification')
    }

    const payload: any = {
      token: this.apiToken,
      user: this.userKey,
      message,
      title,
      priority,
      sound,
    }

    // Add optional parameters
    if (url) {
      payload.url = url
      if (urlTitle) {
        payload.url_title = urlTitle
      }
    }

    try {
      console.log(`📱 Sending Pushover notification: ${title} - ${message}`)

      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000, // 10 second timeout
      })

      if (response.data.status === 1) {
        console.log('✅ Pushover notification sent successfully')
        return { success: true, data: response.data }
      } else {
        console.error('❌ Pushover notification failed:', response.data)
        return { success: false, error: response.data.errors || 'Unknown error' }
      }
    } catch (error: any) {
      console.error('❌ Error sending Pushover notification:', error.message)

      // Return a structured error response
      return {
        success: false,
        error: error.response?.data?.errors || error.message || 'Network error',
      }
    }
  }

  /**
   * Send an incoming call notification
   */
  async sendIncomingCallNotification(fromNumber: string, _callSid: string): Promise<PushoverResponse> {
    const formattedNumber = this.formatPhoneNumber(fromNumber)

    return this.sendNotification({
      title: '📞 Incoming Call',
      message: `Call from ${formattedNumber}`,
      priority: '1', // High priority for incoming calls
      sound: 'incoming', // Use incoming call sound
      url: `${config.APP_URL}/voice`,
      urlTitle: 'View Call History',
    })
  }

  /**
   * Send a voicemail notification
   */
  async sendVoicemailNotification(
    fromNumber: string,
    _callSid: string,
    duration?: number
  ): Promise<PushoverResponse> {
    const formattedNumber = this.formatPhoneNumber(fromNumber)
    const durationText = duration && duration > 0 ? ` (${duration}s)` : ''
    const message = `New voicemail from ${formattedNumber}${durationText}`

    return this.sendNotification({
      title: '🎵 New Voicemail',
      message,
      priority: '1', // High priority for voicemails
      sound: 'magic', // Use a distinctive sound for voicemails
      url: `${config.APP_URL}/voice`,
      urlTitle: 'Listen to Voicemail',
    })
  }

  /**
   * Send a missed call notification
   */
  async sendMissedCallNotification(fromNumber: string, _callSid: string): Promise<PushoverResponse> {
    const formattedNumber = this.formatPhoneNumber(fromNumber)

    return this.sendNotification({
      title: '📵 Missed Call',
      message: `Missed call from ${formattedNumber}`,
      priority: '0', // Normal priority for missed calls
      sound: 'intermission',
      url: `${config.APP_URL}/voice`,
      urlTitle: 'View Call History',
    })
  }

  /**
   * Send an SMS notification
   */
  async sendSMSNotification(
    fromNumber: string,
    messageBody?: string,
    hasMedia: boolean = false
  ): Promise<PushoverResponse> {
    const formattedNumber = this.formatPhoneNumber(fromNumber)
    const messageType = hasMedia ? 'MMS' : 'SMS'
    const icon = hasMedia ? '📷' : '💬'

    // Truncate message body for notification (keep it concise)
    const truncatedBody =
      messageBody && messageBody.length > 100
        ? messageBody.substring(0, 100) + '...'
        : messageBody || (hasMedia ? '[Media message]' : '[Empty message]')

    return this.sendNotification({
      title: `${icon} New ${messageType}`,
      message: `From ${formattedNumber}: ${truncatedBody}`,
      priority: '1', // High priority for SMS messages
      sound: 'cashregister', // Use a distinctive sound for SMS
      url: `${config.APP_URL}/sms`,
      urlTitle: 'View Messages',
    })
  }

  /**
   * Send an incoming SMS notification (alias for sendSMSNotification)
   */
  async sendIncomingSMSNotification(
    fromNumber: string,
    messageBody?: string,
    _messageSid?: string,
    hasMedia: boolean = false
  ): Promise<PushoverResponse> {
    return this.sendSMSNotification(fromNumber, messageBody, hasMedia)
  }

  /**
   * Format phone number for display
   */
  private formatPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber) return 'Unknown'

    // Remove +1 country code for US numbers for cleaner display
    if (phoneNumber.startsWith('+1') && phoneNumber.length === 12) {
      const number = phoneNumber.substring(2)
      return `(${number.substring(0, 3)}) ${number.substring(3, 6)}-${number.substring(6)}`
    }

    return phoneNumber
  }

  /**
   * Test the Pushover service configuration
   */
  async testService(): Promise<PushoverResponse> {
    if (!this.enabled) {
      return { success: false, error: 'Service not configured' }
    }

    return this.sendNotification({
      title: '🧪 Test Notification',
      message: 'Pushover service is working correctly!',
      priority: '0',
      sound: 'pushover',
    })
  }
}

// Create singleton instance
const pushoverService = new PushoverService()

export default pushoverService
