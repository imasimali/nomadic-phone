import express, { Response } from 'express'
import { body, query, validationResult } from 'express-validator'
import twilioService from '../services/twilioService.js'
import { asyncHandler, AppError } from '../middleware/errorHandler.js'
import { AuthenticatedRequest, SendSMSRequest } from '../types/index.js'

const router = express.Router()

interface GetMessagesQuery {
  page?: number
  limit?: number
  direction?: 'inbound' | 'outbound'
  status?: string
}

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
  asyncHandler(async (req: express.Request<{}, {}, SendSMSRequest>, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
      return
    }

    const { to, body: messageBody, mediaUrls } = req.body

    try {
      const result = await twilioService.sendSMS(to, messageBody, mediaUrls || null)

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
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    query('direction').optional().isIn(['inbound', 'outbound']),
    query('status').optional().isIn(['accepted', 'queued', 'sending', 'sent', 'failed', 'delivered', 'undelivered', 'receiving', 'received']),
  ],
  asyncHandler(async (req: express.Request<{}, {}, {}, GetMessagesQuery>, res: Response) => {
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
      const result = await twilioService.getMessages({
        limit,
        direction,
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
  asyncHandler(async (req: express.Request, res: Response) => {
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
  [query('page').optional().isInt({ min: 1 }).toInt(), query('limit').optional().isInt({ min: 1, max: 1000 }).toInt()],
  asyncHandler(async (req: express.Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      })
      return
    }

    const { phoneNumber } = req.params
    const limit = parseInt(req.query.limit as string) || 50

    // Validate phone number format
    if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      throw new AppError('Invalid phone number format', 400, 'INVALID_PHONE_NUMBER')
    }

    try {
      const result = await twilioService.getConversation(phoneNumber, { limit })
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
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const conversations = await twilioService.getConversations()
      res.json({ conversations })
    } catch (error) {
      console.error('Error fetching conversations:', error)
      throw new AppError('Failed to fetch conversations', 500, 'FETCH_CONVERSATIONS_FAILED')
    }
  }),
)

export default router
