const twilio = require('twilio')
const fs = require('fs')
const path = require('path')

class ApiKeyService {
  constructor() {
    // Use Account SID and Auth Token to manage API keys
    this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    this.cachedApiKey = null
    this.API_KEY_NAME = 'Nomadic-Phone-App'
    // Store API key data in environment variables for persistence
    this.STORED_API_KEY_SID = process.env.NOMADIC_API_KEY_SID
    this.STORED_API_SECRET = process.env.NOMADIC_API_SECRET
  }

  /**
   * Get or create an API key for general app use (Voice SDK, etc.)
   * First tries to find existing key by name, creates if not found
   * @returns {Promise<{sid: string, secret: string}>}
   */
  async getApiKey() {
    try {
      // Return cached key if available
      if (this.cachedApiKey) {
        return this.cachedApiKey
      }

      // Check if we have stored API key credentials
      if (this.STORED_API_KEY_SID && this.STORED_API_SECRET) {
        console.log(`Using stored API key: ${this.STORED_API_KEY_SID}`)
        this.cachedApiKey = {
          sid: this.STORED_API_KEY_SID,
          secret: this.STORED_API_SECRET,
        }
        return this.cachedApiKey
      }

      // If no stored credentials, create a new API key
      console.log(`Creating new API key: ${this.API_KEY_NAME}`)
      const apiKey = await this.client.newKeys.create({
        friendlyName: this.API_KEY_NAME,
      })

      const keyData = {
        sid: apiKey.sid,
        secret: apiKey.secret,
      }

      // Cache the API key
      this.cachedApiKey = keyData
      console.log(`Created API key: ${apiKey.sid}`)

      // Automatically add to .env file
      await this.addToEnvFile(apiKey.sid, apiKey.secret)

      return keyData
    } catch (error) {
      console.error('Error getting/creating API key:', error)
      throw new Error(`Failed to get/create API key: ${error.message}`)
    }
  }

  /**
   * Find an API key by its friendly name
   * @param {string} friendlyName
   * @returns {Promise<Object|null>}
   */
  async findApiKeyByName(friendlyName) {
    try {
      // Use the correct Twilio API path for listing keys
      const keys = await this.client.keys.list({
        limit: 100, // Get up to 100 keys to search through
      })

      return keys.find((key) => key.friendlyName === friendlyName) || null
    } catch (error) {
      console.error('Error finding API key by name:', error)
      return null
    }
  }

  /**
   * Initialize API key on app startup
   * Call this when the server starts to ensure the key exists
   */
  async initialize() {
    try {
      await this.getApiKey()
      console.log('API key service initialized successfully')
    } catch (error) {
      console.error('Failed to initialize API key service:', error)
      throw error
    }
  }

  /**
   * Recreate the API key (useful for key rotation)
   * Deletes the existing key and creates a new one
   */
  async rotateApiKey() {
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
    } catch (error) {
      console.error('Error rotating API key:', error)
      throw error
    }
  }

  /**
   * Get API key specifically for Voice SDK (alias for getApiKey)
   * @returns {Promise<{sid: string, secret: string}>}
   */
  async getVoiceApiKey() {
    return this.getApiKey()
  }

  /**
   * Get API key for any Twilio service that requires API key/secret
   * @returns {Promise<{sid: string, secret: string}>}
   */
  async getServiceApiKey() {
    return this.getApiKey()
  }

  /**
   * Automatically add API key credentials to .env file
   * @param {string} apiKeySid
   * @param {string} apiSecret
   */
  async addToEnvFile(apiKeySid, apiSecret) {
    try {
      const envPath = path.join(process.cwd(), '.env')

      // Read current .env file
      let envContent = ''
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8')
      }

      // Check if the API key variables already exist
      const hasApiKeySid = envContent.includes('NOMADIC_API_KEY_SID=')
      const hasApiSecret = envContent.includes('NOMADIC_API_SECRET=')

      if (!hasApiKeySid || !hasApiSecret) {
        // Add the API key credentials to the end of the file
        const newLines = []

        if (!hasApiKeySid) {
          newLines.push(`NOMADIC_API_KEY_SID=${apiKeySid}`)
        }
        if (!hasApiSecret) {
          newLines.push(`NOMADIC_API_SECRET=${apiSecret}`)
        }

        // Add a comment if this is the first time adding these
        if (newLines.length > 0) {
          const comment = '\n# Auto-generated API key (created automatically, but stored for persistence)'
          envContent += comment + '\n' + newLines.join('\n') + '\n'

          fs.writeFileSync(envPath, envContent)
          console.log('✅ Automatically added API key credentials to .env file')
        }
      }
    } catch (error) {
      console.error('Error updating .env file:', error)
      console.log('⚠️  Please manually add these to your .env file:')
      console.log(`NOMADIC_API_KEY_SID=${apiKeySid}`)
      console.log(`NOMADIC_API_SECRET=${apiSecret}`)
    }
  }

  /**
   * Clear the cached API key (force refresh on next request)
   */
  clearCache() {
    this.cachedApiKey = null
    this.cacheExpiry = null
  }
}

// Create singleton instance
const apiKeyService = new ApiKeyService()

module.exports = apiKeyService
