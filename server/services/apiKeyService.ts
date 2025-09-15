import twilio, { Twilio } from 'twilio'
import fs from 'fs'
import path from 'path'
import config from '../config.js'
import { ApiKey } from '../types/index.js'

class ApiKeyService {
  private client: Twilio | null
  private readonly API_KEY_NAME: string
  private STORED_API_KEY_SID: string | undefined
  private STORED_API_SECRET: string | undefined

  constructor() {
    if (!config.TWILIO_ACCOUNT_SID || !config.TWILIO_AUTH_TOKEN) {
      console.warn('Twilio credentials not found in configuration')
      this.client = null

      this.API_KEY_NAME = 'Nomadic-Phone-App'
      this.STORED_API_KEY_SID = undefined
      this.STORED_API_SECRET = undefined
      return
    }

    // Use Account SID and Auth Token to manage API keys
    this.client = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN)

    this.API_KEY_NAME = 'Nomadic-Phone-App'
    // Store API key data in environment variables for persistence
    this.STORED_API_KEY_SID = config.NOMADIC_API_KEY_SID
    this.STORED_API_SECRET = config.NOMADIC_API_SECRET
  }

  async initialize(): Promise<void> {
    try {
      await this.getApiKey()
      console.log('✅ API key service initialized successfully')
    } catch (error: any) {
      console.error('❌ Failed to initialize API key service:', error.message)
      throw error
    }
  }

  async getApiKey(): Promise<ApiKey> {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    try {
      // Check if we have stored credentials and they're valid
      if (this.STORED_API_KEY_SID && this.STORED_API_SECRET) {
        console.log(`Using stored API key: ${this.STORED_API_KEY_SID}`)
        const keyData: ApiKey = {
          sid: this.STORED_API_KEY_SID,
          secret: this.STORED_API_SECRET,
        }

        return keyData
      }

      // If no stored credentials, create a new API key
      console.log(`Creating new API key: ${this.API_KEY_NAME}`)
      const apiKey = await this.client.newKeys.create({
        friendlyName: this.API_KEY_NAME,
      })

      const keyData: ApiKey = {
        sid: apiKey.sid,
        secret: apiKey.secret,
      }

      // Cache the API key

      console.log(`Created API key: ${apiKey.sid}`)

      // Automatically add to .env file
      await this.addToEnvFile(apiKey.sid, apiKey.secret)

      return keyData
    } catch (error: any) {
      console.error('Error getting/creating API key:', error)
      throw new Error(`Failed to get/create API key: ${error.message}`)
    }
  }

  private async findApiKeyByName(friendlyName: string): Promise<any | null> {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    try {
      const keys = await this.client.keys.list({ limit: 50 })
      return keys.find((key) => key.friendlyName === friendlyName) || null
    } catch (error: any) {
      console.error('Error finding API key by name:', error)
      return null
    }
  }

  /**
   * Recreate the API key (useful for key rotation)
   * Deletes the existing key and creates a new one
   */
  async rotateApiKey(): Promise<ApiKey> {
    if (!this.client) {
      throw new Error('Twilio client not initialized')
    }

    try {
      // Find and delete existing key
      const existingKey = await this.findApiKeyByName(this.API_KEY_NAME)
      if (existingKey) {
        await this.client.keys(existingKey.sid).remove()
        console.log(`Deleted existing API key: ${existingKey.sid}`)
      }

      // Clear cache and create new key
      this.clearCache()
      const newKey = await this.getApiKey()
      console.log(`Rotated to new API key: ${newKey.sid}`)
      return newKey
    } catch (error: any) {
      console.error('Error rotating API key:', error)
      throw error
    }
  }

  /**
   * Get API key specifically for Voice SDK (alias for getApiKey)
   */
  async getVoiceApiKey(): Promise<ApiKey> {
    return this.getApiKey()
  }

  /**
   * Get API key for any Twilio service that requires API key/secret
   */
  async getServiceApiKey(): Promise<ApiKey> {
    return this.getApiKey()
  }

  /**
   * Automatically add API key credentials to .env file
   */
  private async addToEnvFile(apiKeySid: string, apiSecret: string): Promise<void> {
    try {
      const envPath = path.join(process.cwd(), '.env')

      // Read current .env file
      let envContent = ''
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8')
      }

      // Check if the keys already exist
      const hasApiKeySid = envContent.includes('NOMADIC_API_KEY_SID=')
      const hasApiSecret = envContent.includes('NOMADIC_API_SECRET=')

      // Add or update the keys
      if (!hasApiKeySid) {
        envContent += `\nNOMADIC_API_KEY_SID=${apiKeySid}`
      } else {
        envContent = envContent.replace(/NOMADIC_API_KEY_SID=.*/, `NOMADIC_API_KEY_SID=${apiKeySid}`)
      }

      if (!hasApiSecret) {
        envContent += `\nNOMADIC_API_SECRET=${apiSecret}`
      } else {
        envContent = envContent.replace(/NOMADIC_API_SECRET=.*/, `NOMADIC_API_SECRET=${apiSecret}`)
      }

      // Write back to .env file
      fs.writeFileSync(envPath, envContent)

      // Update the stored values
      this.STORED_API_KEY_SID = apiKeySid
      this.STORED_API_SECRET = apiSecret

      console.log('✅ Updated .env file with API key credentials')
    } catch (error: any) {
      console.error('Error updating .env file:', error)
      console.log('⚠️  Please manually add these to your .env file:')
      console.log(`NOMADIC_API_KEY_SID=${apiKeySid}`)
      console.log(`NOMADIC_API_SECRET=${apiSecret}`)
    }
  }

  /**
   * Clear the cached API key (force refresh on next request)
   */
  clearCache(): void {
    // Cache clearing logic would go here if we had caching
  }
}

// Create singleton instance
const apiKeyService = new ApiKeyService()

export default apiKeyService
