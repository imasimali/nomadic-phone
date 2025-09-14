import twilio from 'twilio'
import config from '../config.js'

class TwiMLAppService {
  constructor() {
    if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN) {
      console.warn('Twilio credentials not found in configuration')
      this.client = null
      return
    }

    this.client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)
    this.APP_NAME = 'Nomadic-Phone-Voice-App'
  }

  async ensureTwiMLApp() {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    try {
      // Build configuration object for TwiML Application
      const appConfig = {
        friendlyName: this.APP_NAME,
        voiceUrl: `${config.WEBHOOK_BASE_URL}/webhooks/voice/twiml-app`,
        voiceMethod: 'POST',
        voiceFallbackUrl: `${config.WEBHOOK_BASE_URL}/webhooks/voice/twiml-app`,
        voiceFallbackMethod: 'POST',
        statusCallback: `${config.WEBHOOK_BASE_URL}/webhooks/voice/status`,
        statusCallbackMethod: 'POST',
        smsUrl: `${config.WEBHOOK_BASE_URL}/webhooks/sms/incoming`,
        smsMethod: 'POST',
        smsFallbackUrl: `${config.WEBHOOK_BASE_URL}/webhooks/sms/incoming`,
        smsFallbackMethod: 'POST',
        smsStatusCallback: `${config.WEBHOOK_BASE_URL}/webhooks/sms/status`,
      }

      // First, try to find existing app by name
      const existingApps = await this.client.applications.list({
        friendlyName: this.APP_NAME,
        limit: 1,
      })

      let app
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
    } catch (error) {
      console.error('Error managing TwiML Application:', error)
      throw new Error(`Failed to manage TwiML Application: ${error.message}`)
    }
  }

  async updateEnvFile(appSid) {
    try {
      const fs = await import('fs')
      const path = await import('path')

      const envPath = path.resolve('.env')

      // Read current .env file
      let envContent = ''
      try {
        envContent = fs.readFileSync(envPath, 'utf8')
      } catch (error) {
        console.warn('.env file not found, will create new one')
      }

      // Update or add TWILIO_APPLICATION_SID
      const appSidLine = `TWILIO_APPLICATION_SID=${appSid}`

      if (envContent.includes('TWILIO_APPLICATION_SID=')) {
        // Replace existing line
        envContent = envContent.replace(/TWILIO_APPLICATION_SID=.*/, appSidLine)
        console.log(`📝 Updated TWILIO_APPLICATION_SID in .env file`)
      } else {
        // Add new line after other Twilio config
        const lines = envContent.split('\n')
        let insertIndex = -1

        // Find where to insert (after TWILIO_PHONE_NUMBER)
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('TWILIO_PHONE_NUMBER=')) {
            insertIndex = i + 1
            break
          }
        }

        if (insertIndex > -1) {
          lines.splice(insertIndex, 0, appSidLine)
        } else {
          // If no TWILIO_PHONE_NUMBER found, add at end of Twilio section
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('TWILIO_AUTH_TOKEN=')) {
              insertIndex = i + 1
              break
            }
          }
          if (insertIndex > -1) {
            lines.splice(insertIndex, 0, appSidLine)
          } else {
            lines.push(appSidLine)
          }
        }

        envContent = lines.join('\n')
        console.log(`📝 Added TWILIO_APPLICATION_SID to .env file`)
      }

      // Write back to .env file
      fs.writeFileSync(envPath, envContent)

      // Update the config object in memory
      config.TWILIO_APPLICATION_SID = appSid
      process.env.TWILIO_APPLICATION_SID = appSid
    } catch (error) {
      console.warn('Could not update .env file:', error.message)
      // Don't throw error, just warn - the app can still work
    }
  }

  async getTwiMLApp() {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    try {
      const apps = await this.client.applications.list({
        friendlyName: this.APP_NAME,
        limit: 1,
      })

      return apps.length > 0 ? apps[0] : null
    } catch (error) {
      console.error('Error fetching TwiML Application:', error)
      throw new Error(`Failed to fetch TwiML Application: ${error.message}`)
    }
  }
}

export default new TwiMLAppService()
