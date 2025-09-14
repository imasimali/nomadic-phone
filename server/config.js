import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') })

export default {
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
  TWILIO_APPLICATION_SID: process.env.TWILIO_APPLICATION_SID,
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  APP_PASSWORD: process.env.APP_PASSWORD,
  APP_URL: process.env.APP_URL,
  WEBHOOK_BASE_URL: process.env.WEBHOOK_BASE_URL,
  NOMADIC_API_KEY_SID: process.env.NOMADIC_API_KEY_SID,
  NOMADIC_API_SECRET: process.env.NOMADIC_API_SECRET,
  // Voice configuration
  REDIRECT_NUMBER: process.env.REDIRECT_NUMBER,
  VOICE_MESSAGE: process.env.VOICE_MESSAGE || 'Please leave a message after the beep.',
  VOICE_MISSING_RECORD: process.env.VOICE_MISSING_RECORD || 'No message was recorded. Goodbye.',
  // Pushover configuration
  PUSHOVER_USER_KEY: process.env.PUSHOVER_USER_KEY,
  PUSHOVER_API_TOKEN: process.env.PUSHOVER_API_TOKEN,
}
