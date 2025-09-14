const express = require('express')
const twilio = require('twilio')
const { asyncHandler } = require('../middleware/errorHandler')

const router = express.Router()

// Twilio webhook validation middleware
const validateTwilioRequest = (req, res, next) => {
  const twilioSignature = req.headers['x-twilio-signature']
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`

  if (process.env.NODE_ENV === 'production') {
    const isValid = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, twilioSignature, url, req.body)

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
    const { From, To } = req.body

    // Check if this is our configured Twilio number
    if (To !== process.env.TWILIO_PHONE_NUMBER) {
      const twiml = new twilio.twiml.VoiceResponse()
      twiml.say('This number is not configured. Goodbye.')
      return res.type('text/xml').send(twiml.toString())
    }

    // Use default settings since we don't have a database
    // Get action from environment variable, default to 'recording'
    const action = process.env.INCOMING_CALL_ACTION || 'recording'
    const twiml = new twilio.twiml.VoiceResponse()

    switch (action) {
      case 'client':
        // Forward to browser client
        const dial = twiml.dial({ callerId: To })
        dial.client('nomadic_client')
        break

      case 'redirect':
        // Forward to another number (would need to be configured in env)
        if (process.env.REDIRECT_NUMBER) {
          twiml.dial(process.env.REDIRECT_NUMBER)
        } else {
          twiml.say('No redirect number configured. Going to voicemail.')
          twiml.say(process.env.VOICE_MESSAGE || 'Please leave a message after the beep.')
          twiml.record({
            maxLength: 300,
            recordingStatusCallback: `${process.env.WEBHOOK_BASE_URL}/webhooks/voice/recording`,
          })
        }
        break

      default: // 'recording'
        twiml.say(process.env.VOICE_MESSAGE || 'Please leave a message after the beep.')
        twiml.record({
          maxLength: 300,
          recordingStatusCallback: `${process.env.WEBHOOK_BASE_URL}/webhooks/voice/recording`,
        })
        break
    }

    res.type('text/xml').send(twiml.toString())
  }),
)

// Handle outbound calls
router.post(
  '/voice/outbound',
  validateTwilioRequest,
  asyncHandler(async (req, res) => {
    const { To } = req.body

    const twiml = new twilio.twiml.VoiceResponse()
    const dial = twiml.dial({ callerId: process.env.TWILIO_PHONE_NUMBER })
    dial.number(To)

    res.type('text/xml').send(twiml.toString())
  }),
)

// Handle call status updates
router.post(
  '/voice/status',
  validateTwilioRequest,
  asyncHandler(async (req, res) => {
    const { CallSid, CallStatus, CallDuration } = req.body

    // Since we're using Twilio API directly, we don't need to store status updates
    // The status will be fetched from Twilio when needed
    console.log(`Call ${CallSid} status updated to ${CallStatus}${CallDuration ? ` (duration: ${CallDuration}s)` : ''}`)

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
    if (To !== process.env.TWILIO_PHONE_NUMBER) {
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

module.exports = router
