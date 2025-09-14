const express = require('express')
const { body, query, validationResult } = require('express-validator')
const twilio = require('twilio')
const twilioService = require('../services/twilioService')
const { asyncHandler, AppError } = require('../middleware/errorHandler')

const router = express.Router()

// Initialize Twilio client using Account SID and Auth Token
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

// Send SMS
router.post(
  '/send',
  [
    body('to')
      .matches(/^\+[1-9]\d{1,14}$/)
      .withMessage('Valid phone number in E.164 format required'),
    body('body').isLength({ min: 1, max: 1600 }).withMessage('Message body must be 1-1600 characters'),
    body('mediaUrls').optional().isArray({ max: 10 }).withMessage('Maximum 10 media URLs allowed'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const { to, body: messageBody, mediaUrls } = req.body

    try {
      const result = await twilioService.sendSMS(to, messageBody, mediaUrls)

      res.json({
        message: 'SMS sent successfully',
        messageSid: result.messageSid,
        status: result.status,
      })
    } catch (error) {
      console.error('Error sending SMS:', error)
      throw new AppError('Failed to send SMS', 500, 'SMS_SEND_FAILED')
    }
  }),
)

// Get SMS history
router.get(
  '/messages',
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('direction').optional().isIn(['inbound', 'outbound']),
    query('status').optional().isIn(['accepted', 'queued', 'sending', 'sent', 'failed', 'delivered', 'undelivered', 'receiving', 'received']),
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
      const result = await twilioService.getMessages({
        page,
        limit,
        direction,
        status,
      })

      res.json(result)
    } catch (error) {
      console.error('Error fetching messages:', error)
      throw new AppError('Failed to fetch message history', 500, 'FETCH_MESSAGES_FAILED')
    }
  }),
)

// Get specific SMS details
router.get(
  '/messages/:messageSid',
  asyncHandler(async (req, res) => {
    const { messageSid } = req.params

    try {
      const message = await twilioService.getMessage(messageSid)
      res.json({ message })
    } catch (error) {
      console.error('Error fetching message:', error)
      throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND')
    }
  }),
)

// Get conversation with a specific number
router.get(
  '/conversations/:phoneNumber',
  [query('page').optional().isInt({ min: 1 }).toInt(), query('limit').optional().isInt({ min: 1, max: 100 }).toInt()],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
    }

    const { phoneNumber } = req.params
    const page = req.query.page || 1
    const limit = req.query.limit || 50

    // Validate phone number format
    if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      throw new AppError('Invalid phone number format', 400, 'INVALID_PHONE_NUMBER')
    }

    try {
      const result = await twilioService.getConversation(phoneNumber, { page, limit })
      res.json(result)
    } catch (error) {
      console.error('Error fetching conversation:', error)
      throw new AppError('Failed to fetch conversation', 500, 'FETCH_CONVERSATION_FAILED')
    }
  }),
)

// Get list of conversations (unique phone numbers)
router.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    try {
      const conversations = await twilioService.getConversations()
      res.json({ conversations })
    } catch (error) {
      console.error('Error fetching conversations:', error)
      throw new AppError('Failed to fetch conversations', 500, 'FETCH_CONVERSATIONS_FAILED')
    }
  }),
)

module.exports = router
