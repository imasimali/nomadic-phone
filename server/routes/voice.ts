import express, { Response } from 'express'
import { body, query, validationResult } from 'express-validator'
import twilio from 'twilio'
import axios from 'axios'
import twilioService from '../services/twilioService.js'
import apiKeyService from '../services/apiKeyService.js'
import twimlAppService from '../services/twimlAppService.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { AuthenticatedRequest, VoiceSettings } from '../types/index.js'

const router = express.Router()

interface GetCallsQuery {
  page?: number
  limit?: number
  direction?: 'inbound' | 'outbound'
  status?: string
}

interface GetRecordingsQuery {
  page?: number
  limit?: number
}

// Generate access token for Twilio Voice SDK
router.get(
  '/token',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Check if Twilio credentials are configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      res.status(503).json({
        error: 'Twilio credentials not configured',
        message: 'Please configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your environment variables',
      })
      return
    }

    // Auto-configure TwiML Application if needed
    let applicationSid = process.env.TWILIO_APPLICATION_SID
    try {
      const twimlApp = await twimlAppService.ensureTwiMLApp()
      applicationSid = twimlApp.sid
      console.log(`🎯 Using TwiML Application: ${applicationSid}`)
    } catch (error: any) {
      console.warn('Failed to auto-configure TwiML Application:', error.message)
      // Continue with existing APPLICATION_SID if available
      if (!applicationSid) {
        res.status(503).json({
          error: 'TwiML Application not configured',
          message: 'Failed to auto-configure TwiML Application and no TWILIO_APPLICATION_SID provided',
        })
        return
      }
    }

    const { AccessToken } = twilio.jwt
    const { VoiceGrant } = AccessToken

    const apiKeyData = await apiKeyService.getApiKey()

    const apiKey = apiKeyData.sid
    const apiSecret = apiKeyData.secret

    if (!req.user?.twilio_client_name) {
      res.status(400).json({
        error: 'User not properly authenticated',
        message: 'Missing twilio_client_name in user data',
      })
      return
    }

    const accessToken = new AccessToken(process.env.TWILIO_ACCOUNT_SID!, apiKey, apiSecret, {
      identity: req.user.twilio_client_name,
      ttl: 3600, // 1 hour
    })

    // Create voice grant with auto-configured Application SID
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: applicationSid,
      incomingAllow: true,
    })

    accessToken.addGrant(voiceGrant)

    // Generate the token
    const token = accessToken.toJwt()

    res.json({
      token,
      identity: req.user.twilio_client_name,
      applicationSid, // Include for debugging
    })
  }),
)

// Configure TwiML Application
router.post(
  '/configure-app',
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const twimlApp = await twimlAppService.ensureTwiMLApp()

      res.json({
        message: 'TwiML Application configured successfully',
        application: {
          sid: twimlApp.sid,
          friendlyName: twimlApp.friendlyName,
          voiceUrl: twimlApp.voiceUrl,
          created: twimlApp.created,
        },
      })
    } catch (error) {
      console.error('Error configuring TwiML Application:', error)
      throw new AppError('Failed to configure TwiML Application', 500, 'TWIML_CONFIG_FAILED')
    }
  }),
)

// Get call history
router.get(
  '/calls',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 10000 }).toInt(),
    query('direction').optional().isIn(['inbound', 'outbound']),
    query('status').optional().isIn(['queued', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled']),
  ],
  asyncHandler(async (req: express.Request<{}, {}, {}, GetCallsQuery>, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
      return
    }

    const limit = req.query.limit || 20
    const direction = req.query.direction

    try {
      const result = await twilioService.getCalls({
        limit,
        direction,
      })

      res.json(result)
    } catch (error) {
      console.error('Error fetching calls:', error)
      throw new AppError('Failed to fetch call history', 500, 'FETCH_CALLS_FAILED')
    }
  }),
)

// Get recordings
router.get(
  '/recordings',
  [query('page').optional().isInt({ min: 1 }).toInt(), query('limit').optional().isInt({ min: 1, max: 10000 }).toInt()],
  asyncHandler(async (req: express.Request<{}, {}, {}, GetRecordingsQuery>, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
      return
    }

    const limit = req.query.limit || 20

    try {
      const result = await twilioService.getRecordings({
        limit,
      })

      res.json(result)
    } catch (error) {
      console.error('Error fetching recordings:', error)
      throw new AppError('Failed to fetch recordings', 500, 'FETCH_RECORDINGS_FAILED')
    }
  }),
)

// Get specific call details
router.get(
  '/calls/:callSid',
  asyncHandler(async (req: express.Request, res: Response) => {
    const { callSid } = req.params

    try {
      const call = await twilioService.getCall(callSid)
      res.json({ call })
    } catch (error) {
      console.error('Error fetching call:', error)
      throw new AppError('Call not found', 404, 'CALL_NOT_FOUND')
    }
  }),
)

// Get user's voice settings
router.get(
  '/settings',
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    // Return current settings from environment
    const settings = {
      redirect_number: process.env.REDIRECT_NUMBER || '',
      voice_message: process.env.VOICE_MESSAGE || "Hello, you've reached my voicemail. Please leave a message after the beep and press star to finish.",
      push_notifications: !!(process.env.PUSHOVER_USER_KEY && process.env.PUSHOVER_API_TOKEN),
    }

    res.json({ settings })
  }),
)

// Update voice settings
router.put(
  '/settings',
  [
    body('redirect_number')
      .optional()
      .custom((value) => {
        if (value && !value.match(/^\+[1-9]\d{1,14}$/)) {
          throw new Error('Valid phone number in E.164 format required')
        }
        return true
      }),
    body('voice_message').optional().isLength({ min: 1, max: 500 }).withMessage('Voice message must be 1-500 characters'),
  ],
  asyncHandler(async (req: express.Request<{}, {}, Partial<VoiceSettings>>, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
      return
    }

    // Note: In this simplified version, settings are managed via environment variables
    // This endpoint is kept for API compatibility but doesn't actually update settings
    console.log('Voice settings update requested:', req.body)

    res.json({
      message: 'Settings received. Note: Settings are currently managed via environment variables.',
      received: req.body,
      current_settings: {
        redirect_number: process.env.REDIRECT_NUMBER || '',
        voice_message: process.env.VOICE_MESSAGE || "Hello, you've reached my voicemail. Please leave a message after the beep and press star to finish.",
        push_notifications: !!(process.env.PUSHOVER_USER_KEY && process.env.PUSHOVER_API_TOKEN),
      },
    })
  }),
)

// Proxy endpoint for recording downloads with authentication
router.get(
  '/recordings/:recordingSid',
  asyncHandler(async (req: express.Request, res: Response) => {
    const { recordingSid } = req.params

    try {
      // Get the recording from Twilio to verify it exists and get the URL
      const recording = await twilioService.getRecording(recordingSid)

      if (!recording) {
        throw new AppError('Recording not found', 404, 'RECORDING_NOT_FOUND')
      }

      // Create authenticated URL for the recording
      const recordingUrl = `https://api.twilio.com${recording.uri.replace('.json', '.mp3')}`

      // Set appropriate headers for audio streaming
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': `attachment; filename="recording-${recordingSid}.mp3"`,
        'Cache-Control': 'private, max-age=3600',
      })

      // Use Twilio client to fetch the recording with proper authentication
      const response = await axios.get(recordingUrl, {
        auth: {
          username: process.env.TWILIO_ACCOUNT_SID!,
          password: process.env.TWILIO_AUTH_TOKEN!,
        },
        responseType: 'stream',
      })

      // Pipe the audio stream to the client
      response.data.pipe(res)
    } catch (error: any) {
      console.error('Error fetching recording:', error)
      if (error.status === 404) {
        throw new AppError('Recording not found', 404, 'RECORDING_NOT_FOUND')
      }
      throw new AppError('Failed to fetch recording', 500, 'RECORDING_FETCH_FAILED')
    }
  }),
)

export default router
