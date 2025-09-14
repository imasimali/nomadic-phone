import express from 'express'
import twilio from 'twilio'
import { asyncHandler } from '../middleware/errorHandler.js'
import pushoverService from '../services/pushoverService.js'
import config from '../config.js'

const router = express.Router()

// Twilio webhook validation middleware
const validateTwilioRequest = (req, res, next) => {
  const twilioSignature = req.headers['x-twilio-signature']
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`

  if (config.NODE_ENV === 'production') {
    const isValid = twilio.validateRequest(config.TWILIO_AUTH_TOKEN, twilioSignature, url, req.body)

    if (!isValid) {
      return res.status(403).json({ error: 'Invalid Twilio signature' })
    }
  }

  next()
}

// Voice webhook handlers

// Handle incoming calls
router.post(
  '/voice/incoming',
  validateTwilioRequest,
  asyncHandler(async (req, res) => {
    const { From, To, CallSid } = req.body

    // Check if this is our configured Twilio number
    if (To !== config.TWILIO_PHONE_NUMBER) {
      const twiml = new twilio.twiml.VoiceResponse()
      twiml.say('This number is not configured. Goodbye.')
      return res.type('text/xml').send(twiml.toString())
    }

    // Send push notification for incoming call
    try {
      await pushoverService.sendIncomingCallNotification(From, CallSid)
    } catch (error) {
      console.error('Failed to send incoming call notification:', error)
      // Don't fail the call if notification fails
    }

    const twiml = new twilio.twiml.VoiceResponse()

    // Check if we should redirect to another number
    if (config.REDIRECT_NUMBER) {
      console.log(`Redirecting call to ${config.REDIRECT_NUMBER}`)
      const dial = twiml.dial({
        timeout: 30, // Ring for 30 seconds before going to voicemail
        action: `${config.WEBHOOK_BASE_URL}/webhooks/voice/call-timeout`,
        method: 'POST'
      })
      dial.number(config.REDIRECT_NUMBER)
    } else {
      // Forward to browser client with timeout handling
      console.log('Forwarding call to browser client')
      const dial = twiml.dial({
        callerId: To,
        timeout: 30, // Ring for 30 seconds before going to voicemail
        action: `${config.WEBHOOK_BASE_URL}/webhooks/voice/call-timeout`,
        method: 'POST'
      })
      dial.client('nomadic_client')
    }

    res.type('text/xml').send(twiml.toString())
  }),
)

// Handle outbound calls from Voice SDK
router.post(
  '/voice/outbound',
  validateTwilioRequest,
  asyncHandler(async (req, res) => {
    const { To, From, CallSid } = req.body
    const twiml = new twilio.twiml.VoiceResponse()

    // For calls initiated from the Voice SDK, dial the target number
    const dial = twiml.dial({
      callerId: config.TWILIO_PHONE_NUMBER,
      // Set up event callbacks for call progress
      action: `${config.WEBHOOK_BASE_URL}/webhooks/voice/dial-status`,
      method: 'POST'
    })
    dial.number(To)
    res.type('text/xml').send(twiml.toString())
  }),
)

// Handle call timeout - when client or redirect number doesn't answer
router.post(
  '/voice/call-timeout',
  validateTwilioRequest,
  asyncHandler(async (req, res) => {
    const { DialCallStatus, DialCallDuration } = req.body

    console.log(`Call timeout status: ${DialCallStatus}${DialCallDuration ? ` (duration: ${DialCallDuration}s)` : ''}`)

    const twiml = new twilio.twiml.VoiceResponse()

    // Check if call wasn't answered (timeout, busy, failed, canceled)
    const unansweredStatuses = ['no-answer', 'busy', 'failed', 'canceled']
    if (unansweredStatuses.includes(DialCallStatus)) {
      console.log(`Call not answered (${DialCallStatus}), redirecting to voicemail`)

      // Go to voicemail
      twiml.say(config.VOICE_MESSAGE)
      twiml.record({
        maxLength: 300,
        recordingStatusCallback: `${config.WEBHOOK_BASE_URL}/webhooks/voice/recording`,
      })
    }

    res.type('text/xml').send(twiml.toString())
  }),
)

// Handle dial status for outbound calls
router.post(
  '/voice/dial-status',
  validateTwilioRequest,
  asyncHandler(async (req, res) => {
    const { DialCallStatus, DialCallDuration } = req.body

    console.log(`Dial status: ${DialCallStatus}${DialCallDuration ? ` (duration: ${DialCallDuration}s)` : ''}`)

    // Return empty TwiML to end the call flow
    const twiml = new twilio.twiml.VoiceResponse()
    res.type('text/xml').send(twiml.toString())
  }),
)

// Handle call status updates
router.post(
  '/voice/status',
  validateTwilioRequest,
  asyncHandler(async (req, res) => {
    const { CallSid, CallStatus, CallDuration, From, To, Direction } = req.body

    console.log(`Call ${CallSid} status updated to ${CallStatus}${CallDuration ? ` (duration: ${CallDuration}s)` : ''}`)

    // Handle completed calls to determine if they were missed or went to voicemail
    if (CallStatus === 'completed') {
      const duration = parseInt(CallDuration) || 0

      // Only process incoming calls
      if (Direction === 'inbound' && To === config.TWILIO_PHONE_NUMBER) {
        // If call duration is very short (< 5 seconds), it was likely missed
        // If it's longer, it either was answered or went to voicemail
        if (duration < 5) {
          try {
            await pushoverService.sendMissedCallNotification(From, CallSid)
          } catch (error) {
            console.error('Failed to send missed call notification:', error)
          }
        }
        // Note: Voicemail notifications are handled in the recording callback
      }
    }

    // Handle failed/canceled calls (also considered missed)
    if (['failed', 'canceled', 'busy', 'no-answer'].includes(CallStatus)) {
      if (Direction === 'inbound' && To === config.TWILIO_PHONE_NUMBER) {
        try {
          await pushoverService.sendMissedCallNotification(From, CallSid)
        } catch (error) {
          console.error('Failed to send missed call notification:', error)
        }
      }
    }

    res.status(200).send('OK')
  }),
)

// Handle recording callbacks
router.post(
  '/voice/recording',
  validateTwilioRequest,
  asyncHandler(async (req, res) => {
    const { CallSid, RecordingUrl, RecordingSid, RecordingDuration } = req.body

    console.log(`Recording available for call ${CallSid}: ${RecordingUrl} (${RecordingDuration}s)`)

    // Send voicemail notification if recording has content
    if (RecordingDuration && parseInt(RecordingDuration) > 0) {
      try {
        // We need to get the call details to find the caller's number
        // For now, we'll use a generic notification since we don't have the From number here
        // In a production system, you might want to store call context or fetch it from Twilio
        await pushoverService.sendNotification({
          title: '🎵 New Voicemail',
          message: `New voicemail recorded (${RecordingDuration}s)`,
          priority: '1',
          sound: 'magic',
          url: `${config.APP_URL}/calls`,
          urlTitle: 'Listen to Voicemail'
        })
      } catch (error) {
        console.error('Failed to send voicemail notification:', error)
        // Don't fail the webhook if notification fails
      }
    } else {
      console.log('No voicemail content recorded (duration: 0s)')
    }

    res.status(200).send('OK')
  }),
)

// SMS webhook handlers

// Handle incoming SMS
router.post(
  '/sms/incoming',
  validateTwilioRequest,
  asyncHandler(async (req, res) => {
    const { MessageSid, From, To, Body, NumMedia } = req.body

    // Check if this is our configured Twilio number
    if (To !== config.TWILIO_PHONE_NUMBER) {
      return res.status(200).send('OK')
    }

    console.log(`Received SMS from ${From}: ${Body}`)

    // Handle media URLs for MMS
    const mediaUrls = []
    if (NumMedia && parseInt(NumMedia) > 0) {
      for (let i = 0; i < parseInt(NumMedia); i++) {
        const mediaUrl = req.body[`MediaUrl${i}`]
        if (mediaUrl) {
          mediaUrls.push(mediaUrl)
          console.log(`Media URL ${i}: ${mediaUrl}`)
        }
      }
    }

    res.status(200).send('OK')
  }),
)

// Handle SMS status updates
router.post(
  '/sms/status',
  validateTwilioRequest,
  asyncHandler(async (req, res) => {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body

    // Since we're using Twilio API directly, we don't need to store status updates
    // The status will be fetched from Twilio when needed
    console.log(`SMS ${MessageSid} status updated to ${MessageStatus}${ErrorCode ? ` (error: ${ErrorCode} - ${ErrorMessage})` : ''}`)

    res.status(200).send('OK')
  }),
)

export default router
