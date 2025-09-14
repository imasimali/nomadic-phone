import express from 'express'
import { body, query, validationResult } from 'express-validator'
import twilio from 'twilio'
import axios from 'axios'
import twilioService from '../services/twilioService.js'
import apiKeyService from '../services/apiKeyService.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'

const router = express.Router()

// Generate access token for Twilio Voice SDK
router.get(
  '/token',
  asyncHandler(async (req, res) => {
    // Check if Twilio credentials are configured
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return res.status(503).json({
        error: 'Twilio credentials not configured',
        message: 'Please configure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in your environment variables',
      })
    }

    const { AccessToken } = twilio.jwt
    const { VoiceGrant } = AccessToken

    const apiKeyData = await apiKeyService.getApiKey()

    const apiKey = apiKeyData.sid
    const apiSecret = apiKeyData.secret

    const accessToken = new AccessToken(process.env.TWILIO_ACCOUNT_SID, apiKey, apiSecret, {
      identity: req.user.twilio_client_name,
      ttl: 3600, // 1 hour
    })

    // Create voice grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_APPLICATION_SID,
      incomingAllow: true,
    })

    accessToken.addGrant(voiceGrant)

    // Generate the token
    const token = accessToken.toJwt()

    res.json({
      token,
      identity: req.user.twilio_client_name,
    })
  }),
)


// Make an outbound call
router.post(
  '/call',
  [
    body('to')
      .matches(/^\+[1-9]\d{1,14}$/)
      .withMessage('Valid phone number in E.164 format required'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const { to } = req.body

    try {
      const result = await twilioService.makeCall(to)

      res.json({
        message: 'Call initiated successfully',
        callSid: result.callSid,
        status: result.status,
      })
    } catch (error) {
      console.error('Error making call:', error)
      throw new AppError('Failed to initiate call', 500, 'CALL_FAILED')
    }
  }),
)

// Get call history
router.get(
  '/calls',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('direction').optional().isIn(['inbound', 'outbound']),
    query('status').optional().isIn(['queued', 'ringing', 'in-progress', 'completed', 'busy', 'failed', 'no-answer', 'canceled']),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const page = req.query.page || 1
    const limit = req.query.limit || 20
    const direction = req.query.direction
    const status = req.query.status

    try {
      const result = await twilioService.getCalls({
        page,
        limit,
        direction,
        status,
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
  [query('page').optional().isInt({ min: 1 }).toInt(), query('limit').optional().isInt({ min: 1, max: 100 }).toInt()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const page = req.query.page || 1
    const limit = req.query.limit || 20

    try {
      const result = await twilioService.getRecordings({
        page,
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
  asyncHandler(async (req, res) => {
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

// Hangup a call
router.post(
  '/calls/:callSid/hangup',
  asyncHandler(async (req, res) => {
    const { callSid } = req.params

    try {
      await twilioService.hangupCall(callSid)

      res.json({
        message: 'Call ended successfully',
        callSid,
      })
    } catch (error) {
      console.error('Error ending call:', error)
      throw new AppError('Failed to end call', 500, 'HANGUP_FAILED')
    }
  }),
)

// Get user's voice settings
router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    // Return default settings since we don't have a database
    const defaultSettings = {
      incoming_call_action: 'recording',
      redirect_number: '',
      voice_message: process.env.VOICE_MESSAGE || "Hello, you've reached my voicemail. Please leave a message after the beep and press star to finish.",
      voice_language: process.env.VOICE_LANGUAGE || 'en-US',
      email_notifications: true,
    }

    res.json({ settings: defaultSettings })
  }),
)

// Update voice settings
router.put(
  '/settings',
  [
    body('incoming_call_action').optional().isIn(['recording', 'client', 'redirect']).withMessage('Invalid incoming call action'),
    body('redirect_number')
      .optional()
      .matches(/^\+[1-9]\d{1,14}$/)
      .withMessage('Valid phone number in E.164 format required'),
    body('voice_language').optional().isLength({ min: 2, max: 10 }).withMessage('Valid language code required'),
    body('voice_message').optional().isLength({ min: 1, max: 500 }).withMessage('Voice message must be 1-500 characters'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const allowedSettings = ['incoming_call_action', 'redirect_number', 'voice_language', 'voice_message']

    const updates = []
    for (const [key, value] of Object.entries(req.body)) {
      if (allowedSettings.includes(key) && value !== undefined) {
        updates.push({ key, value: value.toString(), user_id: req.user.id })
      }
    }

    if (updates.length === 0) {
      throw new AppError('No valid settings to update', 400, 'NO_UPDATE_DATA')
    }

    // Since we don't have a database, just return success
    // In a real implementation, you might want to store these in environment variables
    // or a simple JSON file
    res.json({
      message: 'Settings updated successfully',
    })
  }),
)

// Proxy endpoint for recording downloads with authentication
router.get(
  '/recordings/:recordingSid',
  asyncHandler(async (req, res) => {
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
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        },
        responseType: 'stream',
      })

      // Pipe the audio stream to the client
      response.data.pipe(res)
    } catch (error) {
      console.error('Error fetching recording:', error)
      if (error.status === 404) {
        throw new AppError('Recording not found', 404, 'RECORDING_NOT_FOUND')
      }
      throw new AppError('Failed to fetch recording', 500, 'RECORDING_FETCH_FAILED')
    }
  }),
)

export default router
