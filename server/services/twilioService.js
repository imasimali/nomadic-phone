const twilio = require('twilio');

class TwilioService {
  constructor() {
    this.client = twilio(process.env.TWILIO_API_KEY, process.env.TWILIO_API_SECRET, {
      accountSid: process.env.TWILIO_ACCOUNT_SID
    });
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  // Call-related methods
  async getCalls(options = {}) {
    const { limit = 20, direction } = options;

    try {
      const twilioOptions = {
        limit: Math.min(limit, 50), // Keep it simple
      };

      // Add filters if provided
      if (this.phoneNumber) {
        if (direction === 'inbound') {
          twilioOptions.to = this.phoneNumber;
        } else if (direction === 'outbound') {
          twilioOptions.from = this.phoneNumber;
        }
      }

      const calls = await this.client.calls.list(twilioOptions);

      // Simple transformation
      const transformedCalls = calls.map(call => ({
        id: call.sid,
        call_sid: call.sid,
        from_number: call.from,
        to_number: call.to,
        direction: call.direction,
        status: call.status,
        duration: call.duration ? parseInt(call.duration) : null,
        start_time: call.startTime,
        end_time: call.endTime,
        created_at: call.dateCreated,
        updated_at: call.dateUpdated
      }));

      // Sort by creation date (newest first)
      transformedCalls.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return {
        calls: transformedCalls,
        pagination: {
          page: 1,
          limit: transformedCalls.length,
          total: transformedCalls.length,
          pages: 1
        }
      };

    } catch (error) {
      console.error('Error fetching calls from Twilio:', error);
      throw new Error(`Failed to fetch calls: ${error.message}`);
    }
  }

  async getCall(callSid) {
    try {
      const call = await this.client.calls(callSid).fetch();

      return {
        id: call.sid,
        call_sid: call.sid,
        from_number: call.from,
        to_number: call.to,
        direction: call.direction,
        status: call.status,
        duration: call.duration ? parseInt(call.duration) : null,
        start_time: call.startTime,
        end_time: call.endTime,
        created_at: call.dateCreated,
        updated_at: call.dateUpdated
      };

    } catch (error) {
      console.error('Error fetching call from Twilio:', error);
      throw new Error(`Failed to fetch call: ${error.message}`);
    }
  }



  // Make a call
  async makeCall(to) {
    try {
      const call = await this.client.calls.create({
        to,
        from: this.phoneNumber,
        url: `${process.env.WEBHOOK_BASE_URL}/webhooks/voice/outbound`,
        statusCallback: `${process.env.WEBHOOK_BASE_URL}/webhooks/voice/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: true,
        recordingStatusCallback: `${process.env.WEBHOOK_BASE_URL}/webhooks/voice/recording`,
      });

      return {
        callSid: call.sid,
        status: call.status,
        to: call.to,
        from: call.from
      };
    } catch (error) {
      console.error('Error making call:', error);
      throw new Error(`Failed to make call: ${error.message}`);
    }
  }

  // Hangup a call
  async hangupCall(callSid) {
    try {
      await this.client.calls(callSid).update({ status: 'completed' });
      return { success: true };
    } catch (error) {
      console.error('Error hanging up call:', error);
      throw new Error(`Failed to hangup call: ${error.message}`);
    }
  }

  // Get a specific recording
  async getRecording(recordingSid) {
    const cacheKey = this.getCacheKey('recording', { recordingSid });
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const recording = await this.client.recordings(recordingSid).fetch();

      const transformedRecording = {
        sid: recording.sid,
        call_sid: recording.callSid,
        duration: recording.duration ? parseInt(recording.duration) : null,
        status: recording.status,
        uri: recording.uri,
        date_created: recording.dateCreated,
        date_updated: recording.dateUpdated
      };

      this.setCache(cacheKey, transformedRecording);
      return transformedRecording;

    } catch (error) {
      console.error('Error fetching recording from Twilio:', error);
      throw new Error(`Failed to fetch recording: ${error.message}`);
    }
  }

  // SMS-related methods
  async getMessages(options = {}) {
    const { limit = 20, direction } = options;

    try {
      const twilioOptions = {
        limit: Math.min(limit, 50),
      };

      // Add filters if provided
      if (this.phoneNumber) {
        if (direction === 'inbound') {
          twilioOptions.to = this.phoneNumber;
        } else if (direction === 'outbound') {
          twilioOptions.from = this.phoneNumber;
        }
      }

      const messages = await this.client.messages.list(twilioOptions);

      // Simple transformation
      const transformedMessages = messages.map(message => ({
        id: message.sid,
        message_sid: message.sid,
        from_number: message.from,
        to_number: message.to,
        direction: message.direction,
        body: message.body,
        status: message.status,
        created_at: message.dateCreated,
        updated_at: message.dateUpdated
      }));

      // Sort by creation date (newest first)
      transformedMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return {
        messages: transformedMessages,
        pagination: {
          page: 1,
          limit: transformedMessages.length,
          total: transformedMessages.length,
          pages: 1
        }
      };

    } catch (error) {
      console.error('Error fetching messages from Twilio:', error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
  }

  // Send SMS
  async sendSMS(to, body, mediaUrls = null) {
    try {
      const messageData = {
        to,
        from: this.phoneNumber,
        body,
      };

      if (mediaUrls && mediaUrls.length > 0) {
        messageData.mediaUrl = mediaUrls;
      }

      const message = await this.client.messages.create(messageData);

      return {
        messageSid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        body: message.body
      };
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }
}

// Create singleton instance
const twilioService = new TwilioService();

module.exports = twilioService;
