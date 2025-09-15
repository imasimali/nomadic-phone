import twilio, { Twilio } from 'twilio'
import fs from 'fs'
import path from 'path'
import config from '../config.js'

interface TwiMLAppResult {
  sid: string
  friendlyName: string
  voiceUrl: string
  smsUrl: string
  created: boolean
}

class TwiMLAppService {
  private client: Twilio | null
  private readonly APP_NAME: string

  constructor() {
    if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN) {
      console.warn('Twilio credentials not found in configuration')
      this.client = null
      this.APP_NAME = 'Nomadic-Phone-Voice-App'
      return
    }

    this.client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
    this.APP_NAME = 'Nomadic-Phone-Voice-App'
  }

  async ensureTwiMLApp(): Promise<TwiMLAppResult> {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    try {
      // Build configuration object for TwiML Application
      const appConfig = {
        friendlyName: this.APP_NAME,
        voiceUrl: `${config.WEBHOOK_BASE_URL}/webhooks/voice/twiml-app`,
        voiceMethod: 'POST' as const,
        voiceFallbackUrl: `${config.WEBHOOK_BASE_URL}/webhooks/voice/twiml-app`,
        voiceFallbackMethod: 'POST' as const,
        statusCallback: `${config.WEBHOOK_BASE_URL}/webhooks/voice/status`,
        statusCallbackMethod: 'POST' as const,
        smsUrl: `${config.WEBHOOK_BASE_URL}/webhooks/sms/incoming`,
        smsMethod: 'POST' as const,
        smsFallbackUrl: `${config.WEBHOOK_BASE_URL}/webhooks/sms/incoming`,
        smsFallbackMethod: 'POST' as const,
        smsStatusCallback: `${config.WEBHOOK_BASE_URL}/webhooks/sms/status`,
      }

      // First, try to find existing app by name
      const existingApps = await this.client.applications.list({
        friendlyName: this.APP_NAME,
        limit: 1,
      })

      let app: any
      if (existingApps.length > 0) {
        // Update existing app
        app = existingApps[0]
        console.log(`📱 Found existing TwiML App: ${app.sid}`)

        app = await this.client.applications(app.sid).update(appConfig)
        console.log(`✅ Updated TwiML App: ${app.sid}`)
      } else {
        // Create new app
        console.log(`🆕 Creating new TwiML App: ${this.APP_NAME}`)

        app = await this.client.applications.create(appConfig)
        console.log(`✅ Created TwiML App: ${app.sid}`)
      }

      // Auto-update .env file with the Application SID
      await this.updateEnvFile(app.sid)

      return {
        sid: app.sid,
        friendlyName: app.friendlyName,
        voiceUrl: app.voiceUrl,
        smsUrl: app.smsUrl,
        created: existingApps.length === 0,
      }
    } catch (error: any) {
      console.error('Error managing TwiML Application:', error)
      throw new Error(`Failed to manage TwiML Application: ${error.message}`)
    }
  }

  private async updateEnvFile(appSid: string): Promise<void> {
    try {
      const envPath = path.resolve('.env')

      // Read current .env file
      let envContent = ''
      try {
        envContent = fs.readFileSync(envPath, 'utf8')
      } catch (error) {
        console.warn('.env file not found, will create new one')
      }

      // Check if TWILIO_APPLICATION_SID already exists
      const hasAppSid = envContent.includes('TWILIO_APPLICATION_SID=')

      if (!hasAppSid) {
        // Add new line
        envContent += `\nTWILIO_APPLICATION_SID=${appSid}`
      } else {
        // Update existing line
        envContent = envContent.replace(/TWILIO_APPLICATION_SID=.*/, `TWILIO_APPLICATION_SID=${appSid}`)
      }

      // Write back to .env file
      fs.writeFileSync(envPath, envContent)

      // Update the config object in memory
      ;(config as any).TWILIO_APPLICATION_SID = appSid
      process.env.TWILIO_APPLICATION_SID = appSid
    } catch (error: any) {
      console.warn('Could not update .env file:', error.message)
      // Don't throw error, just warn - the app can still work
    }
  }

  async getTwiMLApp(): Promise<any | null> {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    try {
      const apps = await this.client.applications.list({
        friendlyName: this.APP_NAME,
        limit: 1,
      })

      return apps.length > 0 ? apps[0] : null
    } catch (error: any) {
      console.error('Error fetching TwiML Application:', error)
      throw new Error(`Failed to fetch TwiML Application: ${error.message}`)
    }
  }
}

const twimlAppService = new TwiMLAppService()

export default twimlAppService
