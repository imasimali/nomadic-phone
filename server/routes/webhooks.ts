import express, { Request, Response, NextFunction } from 'express'
import twilio from 'twilio'
import { asyncHandler } from '../middleware/errorHandler.js'
import pushoverService from '../services/pushoverService.js'
import config from '../config.js'
import { TwilioVoiceWebhook, TwilioSMSWebhook } from '../types/index.js'

const router = express.Router()

// Twilio webhook validation middleware
const validateTwilioRequest = (req: Request, res: Response, next: NextFunction): void => {
  const twilioSignature = req.headers['x-twilio-signature'] as string
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`

  if (config.NODE_ENV === 'production') {
    if (!config.TWILIO_AUTH_TOKEN) {
      res.status(500).json({ error: 'Twilio auth token not configured' })
      return
    }

    const isValid = twilio.validateRequest(config.TWILIO_AUTH_TOKEN, twilioSignature, url, req.body)

    if (!isValid) {
      res.status(403).json({ error: 'Invalid Twilio signature' })
      return
    }
  }

  next()
}

// Voice webhook handlers

// Unified voice webhook - handles both incoming and outbound calls
router.post(
  '/voice/twiml-app',
  validateTwilioRequest,
  asyncHandler(async (req: Request<{}, {}, TwilioVoiceWebhook>, res: Response) => {
    const { To, From, CallSid } = req.body
    const twiml = new twilio.twiml.VoiceResponse()

    console.log(`📞 Voice webhook called - From: ${From}, To: ${To}, CallSid: ${CallSid}`)

    // Determine if this is an incoming call or outbound call
    // Incoming calls: To = our Twilio number, From = external caller
    // Outbound calls: From = our client identity, To = external number

    if (To === config.TWILIO_PHONE_NUMBER) {
      // This is an INCOMING call to our Twilio number
      console.log('🔄 Handling incoming call via TwiML App')

      // Send push notification for incoming call
      try {
        await pushoverService.sendIncomingCallNotification(From, CallSid)
      } catch (error) {
        console.error('Failed to send incoming call notification:', error)
        // Don't fail the call if notification fails
      }

      // Check if we should redirect to another number
      if (config.REDIRECT_NUMBER) {
        console.log(`Redirecting call to ${config.REDIRECT_NUMBER}`)
        const dial = twiml.dial({
          timeout: 30, // Ring for 30 seconds before going to voicemail
          action: `${config.WEBHOOK_BASE_URL}/webhooks/voice/call-timeout`,
          method: 'POST',
        })
        dial.number(config.REDIRECT_NUMBER)
      } else {
        // Forward to browser client with timeout handling
        console.log('Forwarding call to browser client')

        // Redirect to retry handler that will keep trying to connect
        twiml.redirect({
          method: 'POST',
        }, `${config.WEBHOOK_BASE_URL}/webhooks/voice/dial-client?attempt=1`)
      }
    } else {
      // This is an OUTBOUND call from the Voice SDK
      console.log('📱 Handling outbound call from browser client')

      // For calls initiated from the Voice SDK, dial the target number
      const dial = twiml.dial({
        callerId: config.TWILIO_PHONE_NUMBER,
        // Set up event callbacks for call progress
        action: `${config.WEBHOOK_BASE_URL}/webhooks/voice/dial-status`,
        method: 'POST',
      })
      dial.number(To)
    }

    res.type('text/xml').send(twiml.toString())
  })
)

// Handle dialing the client with retry logic
router.post(
  '/voice/dial-client',
  validateTwilioRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const attempt = parseInt(req.query.attempt as string) || 1

    console.log(`Attempting to dial client (attempt ${attempt})`)

    const twiml = new twilio.twiml.VoiceResponse()

    // Play ringback tone to give caller audio feedback while connecting
    // Using a standard US ringback tone (2 seconds on, 4 seconds off pattern)
    twiml.say({ voice: 'Polly.Joanna' }, 'Connecting your call, please wait.')
    twiml.pause({ length: 2 })

    // Try to dial the client
    const dial = twiml.dial({
      callerId: req.body.To,
      timeout: 5, // Try for 5 seconds per attempt (if device is registered, it will ring)
      action: `${config.WEBHOOK_BASE_URL}/webhooks/voice/dial-result?attempt=${attempt}`,
      method: 'POST',
      ringTone: 'us', // This plays when device is actually ringing
    })
    dial.client('nomadic_client')

    res.type('text/xml').send(twiml.toString())
  })
)

// Handle the result of a dial attempt
router.post(
  '/voice/dial-result',
  validateTwilioRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { DialCallStatus } = req.body
    const attempt = parseInt(req.query.attempt as string) || 1
    const maxAttempts = 10

    console.log(`Dial attempt ${attempt} result: ${DialCallStatus}`)

    const twiml = new twilio.twiml.VoiceResponse()

    // If call was answered, we're done
    if (DialCallStatus === 'completed') {
      console.log('Call was answered successfully')
      res.type('text/xml').send(twiml.toString())
      return
    }

    // If call was explicitly rejected/canceled/busy, redirect to call-timeout handler
    // Don't retry when user actively rejects the call
    const rejectedStatuses = ['canceled', 'busy', 'failed']
    if (rejectedStatuses.includes(DialCallStatus)) {
      console.log(`Call was rejected/canceled (${DialCallStatus}), redirecting to call-timeout`)
      twiml.redirect({
        method: 'POST',
      }, `${config.WEBHOOK_BASE_URL}/webhooks/voice/call-timeout`)
      res.type('text/xml').send(twiml.toString())
      return
    }

    // If we haven't reached max attempts, try again (only for no-answer)
    if (attempt < maxAttempts) {
      console.log(`Retrying... (attempt ${attempt + 1}/${maxAttempts})`)
      twiml.redirect({
        method: 'POST',
      }, `${config.WEBHOOK_BASE_URL}/webhooks/voice/dial-client?attempt=${attempt + 1}`)
    } else {
      // Max attempts reached, redirect to call-timeout handler
      console.log('Max attempts reached, redirecting to call-timeout')
      twiml.redirect({
        method: 'POST',
      }, `${config.WEBHOOK_BASE_URL}/webhooks/voice/call-timeout`)
    }

    res.type('text/xml').send(twiml.toString())
  })
)

// Handle call timeout - when client or redirect number doesn't answer
router.post(
  '/voice/call-timeout',
  validateTwilioRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { DialCallStatus, DialCallDuration } = req.body

    console.log(`Call timeout status: ${DialCallStatus}${DialCallDuration ? ` (duration: ${DialCallDuration}s)` : ''}`)

    const twiml = new twilio.twiml.VoiceResponse()

    // Check if call wasn't answered (timeout, busy, failed, canceled)
    // If DialCallStatus is undefined, it means we were redirected here (e.g., max attempts reached)
    // In that case, also go to voicemail
    const unansweredStatuses = ['no-answer', 'busy', 'failed', 'canceled']
    if (!DialCallStatus || unansweredStatuses.includes(DialCallStatus)) {
      console.log(`Call not answered (${DialCallStatus || 'redirected'}), redirecting to voicemail`)

      // Go to voicemail
      if (config.VOICE_MESSAGE) {
        twiml.say(config.VOICE_MESSAGE)
      }
      twiml.record({
        maxLength: 300,
        recordingStatusCallback: `${config.WEBHOOK_BASE_URL}/webhooks/voice/recording`,
      })
    }

    res.type('text/xml').send(twiml.toString())
  })
)

// Handle dial status for outbound calls
router.post(
  '/voice/dial-status',
  validateTwilioRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { DialCallStatus, DialCallDuration } = req.body

    console.log(`Dial status: ${DialCallStatus}${DialCallDuration ? ` (duration: ${DialCallDuration}s)` : ''}`)

    // Return empty TwiML to end the call flow
    const twiml = new twilio.twiml.VoiceResponse()
    res.type('text/xml').send(twiml.toString())
  })
)

// Handle call status updates
router.post(
  '/voice/status',
  validateTwilioRequest,
  asyncHandler(async (req: Request, res: Response) => {
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
  })
)

// Handle recording callbacks
router.post(
  '/voice/recording',
  validateTwilioRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { CallSid, RecordingUrl, RecordingDuration } = req.body

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
          url: `${config.APP_URL}/recordings`,
          urlTitle: 'Listen to Voicemail',
        })
      } catch (error) {
        console.error('Failed to send voicemail notification:', error)
        // Don't fail the webhook if notification fails
      }
    } else {
      console.log('No voicemail content recorded (duration: 0s)')
    }

    res.status(200).send('OK')
  })
)

// SMS webhook handlers

// Handle incoming SMS
router.post(
  '/sms/incoming',
  validateTwilioRequest,
  asyncHandler(async (req: Request<{}, {}, TwilioSMSWebhook>, res: Response) => {
    const { MessageSid, From, To, Body, NumMedia } = req.body

    // Check if this is our configured Twilio number
    if (To !== config.TWILIO_PHONE_NUMBER) {
      res.status(200).send('OK')
      return
    }

    console.log(`📱 Received SMS from ${From}: ${Body}`)

    // Handle media URLs for MMS
    const mediaUrls: string[] = []
    if (NumMedia && parseInt(NumMedia) > 0) {
      for (let i = 0; i < parseInt(NumMedia); i++) {
        const mediaUrl = req.body[`MediaUrl${i}`]
        if (mediaUrl) {
          mediaUrls.push(mediaUrl)
          console.log(`Media URL ${i}: ${mediaUrl}`)
        }
      }
    }

    // Send push notification for incoming SMS
    try {
      await pushoverService.sendIncomingSMSNotification(From, Body, MessageSid, mediaUrls.length > 0)
    } catch (error) {
      console.error('Failed to send SMS notification:', error)
      // Don't fail the webhook if notification fails
    }

    res.status(200).send('OK')
  })
)

// Handle SMS status updates
router.post(
  '/sms/status',
  validateTwilioRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body

    // Since we're using Twilio API directly, we don't need to store status updates
    // The status will be fetched from Twilio when needed
    console.log(`SMS ${MessageSid} status updated to ${MessageStatus}${ErrorCode ? ` (error: ${ErrorCode} - ${ErrorMessage})` : ''}`)

    res.status(200).send('OK')
  })
)

export default router
