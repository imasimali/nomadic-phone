import axios from 'axios'
import config from '../config.js'

class PushoverService {
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
   * Send a push notification via Pushover
   * @param {Object} options - Notification options
   * @param {string} options.message - The message content
   * @param {string} [options.title] - The notification title
   * @param {string} [options.priority] - Priority level (-2, -1, 0, 1, 2)
   * @param {string} [options.sound] - Sound name for the notification
   * @param {string} [options.url] - URL to open when notification is tapped
   * @param {string} [options.urlTitle] - Title for the URL
   * @returns {Promise<Object>} Response from Pushover API
   */
  async sendNotification(options) {
    if (!this.enabled) {
      console.warn('Pushover notification skipped: Service not configured')
      return { success: false, error: 'Service not configured' }
    }

    const { message, title = 'Nomadic Phone', priority = '0', sound = 'pushover', url, urlTitle } = options

    if (!message) {
      throw new Error('Message is required for Pushover notification')
    }

    const payload = {
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
    } catch (error) {
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
   * @param {string} fromNumber - The caller's phone number
   * @param {string} callSid - The Twilio call SID
   * @returns {Promise<Object>} Response from Pushover API
   */
  async sendIncomingCallNotification(fromNumber, callSid) {
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
   * @param {string} fromNumber - The caller's phone number
   * @param {string} callSid - The Twilio call SID
   * @param {number} [duration] - Duration of the voicemail in seconds
   * @returns {Promise<Object>} Response from Pushover API
   */
  async sendVoicemailNotification(fromNumber, callSid, duration = null) {
    const formattedNumber = this.formatPhoneNumber(fromNumber)
    let message = `New voicemail from ${formattedNumber}`

    if (duration && duration > 0) {
      const minutes = Math.floor(duration / 60)
      const seconds = duration % 60
      const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
      message += ` (${durationStr})`
    }

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
   * @param {string} fromNumber - The caller's phone number
   * @param {string} callSid - The Twilio call SID
   * @returns {Promise<Object>} Response from Pushover API
   */
  async sendMissedCallNotification(fromNumber, callSid) {
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
   * Format phone number for display
   * @param {string} phoneNumber - Raw phone number
   * @returns {string} Formatted phone number
   */
  formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return 'Unknown Number'

    // Remove any non-digit characters except +
    const cleaned = phoneNumber.replace(/[^\d+]/g, '')

    // If it's a US number (+1XXXXXXXXXX), format it nicely
    if (cleaned.startsWith('+1') && cleaned.length === 12) {
      const number = cleaned.substring(2)
      return `+1 (${number.substring(0, 3)}) ${number.substring(3, 6)}-${number.substring(6)}`
    }

    // For international numbers, just return as-is
    return cleaned
  }

  /**
   * Test the Pushover service configuration
   * @returns {Promise<Object>} Test result
   */
  async testService() {
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
