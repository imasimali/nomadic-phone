const twilio = require('twilio');

class TwilioService {
  constructor() {
    this.client = twilio(process.env.TWILIO_API_KEY, process.env.TWILIO_API_SECRET, {
      accountSid: process.env.TWILIO_ACCOUNT_SID
    });
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
    
    // Simple in-memory cache with TTL
    this.cache = new Map();
    this.cacheTTL = 30000; // 30 seconds
  }

  // Cache helper methods
  getCacheKey(type, params) {
    return `${type}_${JSON.stringify(params)}`;
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Clear cache periodically
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  // Call-related methods
  async getCalls(options = {}) {
    const {
      page = 1,
      limit = 20,
      direction,
      status,
      dateCreatedAfter,
      dateCreatedBefore
    } = options;

    const cacheKey = this.getCacheKey('calls', options);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const twilioOptions = {
        limit: Math.min(limit, 1000), // Twilio's max limit
        pageSize: Math.min(limit, 1000)
      };

      // Add filters if provided
      if (this.phoneNumber) {
        // Get both inbound and outbound calls for our number
        if (direction === 'inbound') {
          twilioOptions.to = this.phoneNumber;
        } else if (direction === 'outbound') {
          twilioOptions.from = this.phoneNumber;
        }
      }

      if (dateCreatedAfter) {
        twilioOptions.startTime = new Date(dateCreatedAfter);
      }
      if (dateCreatedBefore) {
        twilioOptions.endTime = new Date(dateCreatedBefore);
      }

      const calls = await this.client.calls.list(twilioOptions);

      // Transform Twilio call data to match our expected format and fetch recordings
      const transformedCalls = await Promise.all(calls.map(async (call) => {
        const transformedCall = {
          id: call.sid,
          call_sid: call.sid,
          from_number: call.from,
          to_number: call.to,
          direction: call.direction,
          status: call.status,
          duration: call.duration ? parseInt(call.duration) : null,
          start_time: call.startTime,
          end_time: call.endTime,
          recording_url: null,
          recording_sid: null,
          recording_duration: null,
          from_city: call.fromFormatted ? this.extractCity(call.fromFormatted) : null,
          from_state: call.fromFormatted ? this.extractState(call.fromFormatted) : null,
          from_country: call.fromFormatted ? this.extractCountry(call.fromFormatted) : null,
          to_city: call.toFormatted ? this.extractCity(call.toFormatted) : null,
          to_state: call.toFormatted ? this.extractState(call.toFormatted) : null,
          to_country: call.toFormatted ? this.extractCountry(call.toFormatted) : null,
          price: call.price ? parseFloat(call.price) : null,
          price_unit: call.priceUnit || 'USD',
          answered_by: call.answeredBy || null,
          created_at: call.dateCreated,
          updated_at: call.dateUpdated
        };

        // Try to get recording info if available
        try {
          const recordings = await this.client.recordings.list({ callSid: call.sid, limit: 1 });
          if (recordings.length > 0) {
            const recording = recordings[0];
            // Use our proxy endpoint instead of direct Twilio URL
            transformedCall.recording_url = `/api/voice/recordings/${recording.sid}`;
            transformedCall.recording_sid = recording.sid;
            transformedCall.recording_duration = recording.duration ? parseInt(recording.duration) : null;
          }
        } catch (recordingError) {
          console.warn('Could not fetch recording for call:', call.sid, recordingError.message);
        }

        return transformedCall;
      }));

      // Apply additional filtering if needed
      let filteredCalls = transformedCalls;
      
      if (status) {
        filteredCalls = filteredCalls.filter(call => call.status === status);
      }

      // Sort by creation date (newest first)
      filteredCalls.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const paginatedCalls = filteredCalls.slice(startIndex, startIndex + limit);

      const result = {
        calls: paginatedCalls,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredCalls.length,
          pages: Math.ceil(filteredCalls.length / limit)
        }
      };

      this.setCache(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error fetching calls from Twilio:', error);
      throw new Error(`Failed to fetch calls: ${error.message}`);
    }
  }

  async getCall(callSid) {
    const cacheKey = this.getCacheKey('call', { callSid });
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const call = await this.client.calls(callSid).fetch();
      
      const transformedCall = {
        id: call.sid,
        call_sid: call.sid,
        from_number: call.from,
        to_number: call.to,
        direction: call.direction,
        status: call.status,
        duration: call.duration ? parseInt(call.duration) : null,
        start_time: call.startTime,
        end_time: call.endTime,
        recording_url: null,
        recording_sid: null,
        recording_duration: null,
        from_city: call.fromFormatted ? this.extractCity(call.fromFormatted) : null,
        from_state: call.fromFormatted ? this.extractState(call.fromFormatted) : null,
        from_country: call.fromFormatted ? this.extractCountry(call.fromFormatted) : null,
        to_city: call.toFormatted ? this.extractCity(call.toFormatted) : null,
        to_state: call.toFormatted ? this.extractState(call.toFormatted) : null,
        to_country: call.toFormatted ? this.extractCountry(call.toFormatted) : null,
        price: call.price ? parseFloat(call.price) : null,
        price_unit: call.priceUnit || 'USD',
        answered_by: call.answeredBy || null,
        created_at: call.dateCreated,
        updated_at: call.dateUpdated
      };

      // Try to get recording info if available
      try {
        const recordings = await this.client.recordings.list({ callSid: call.sid, limit: 1 });
        if (recordings.length > 0) {
          const recording = recordings[0];
          // Use our proxy endpoint instead of direct Twilio URL
          transformedCall.recording_url = `/api/voice/recordings/${recording.sid}`;
          transformedCall.recording_sid = recording.sid;
          transformedCall.recording_duration = recording.duration ? parseInt(recording.duration) : null;
        }
      } catch (recordingError) {
        console.warn('Could not fetch recording for call:', callSid, recordingError.message);
      }

      this.setCache(cacheKey, transformedCall);
      return transformedCall;

    } catch (error) {
      console.error('Error fetching call from Twilio:', error);
      throw new Error(`Failed to fetch call: ${error.message}`);
    }
  }

  // Helper methods for parsing location data
  extractCity(formatted) {
    // This is a simple implementation - you might want to enhance this
    const parts = formatted.split(',');
    return parts.length > 1 ? parts[0].trim() : null;
  }

  extractState(formatted) {
    const parts = formatted.split(',');
    return parts.length > 2 ? parts[1].trim() : null;
  }

  extractCountry(formatted) {
    const parts = formatted.split(',');
    return parts.length > 2 ? parts[parts.length - 1].trim() : null;
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
    const {
      page = 1,
      limit = 20,
      direction,
      status,
      dateCreatedAfter,
      dateCreatedBefore
    } = options;

    const cacheKey = this.getCacheKey('messages', options);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const twilioOptions = {
        limit: Math.min(limit, 1000),
        pageSize: Math.min(limit, 1000)
      };

      // Add filters if provided
      if (this.phoneNumber) {
        if (direction === 'inbound') {
          twilioOptions.to = this.phoneNumber;
        } else if (direction === 'outbound') {
          twilioOptions.from = this.phoneNumber;
        }
      }

      if (dateCreatedAfter) {
        twilioOptions.dateSentAfter = new Date(dateCreatedAfter);
      }
      if (dateCreatedBefore) {
        twilioOptions.dateSentBefore = new Date(dateCreatedBefore);
      }

      const messages = await this.client.messages.list(twilioOptions);

      // Transform Twilio message data to match our expected format
      const transformedMessages = messages.map(message => ({
        id: message.sid,
        message_sid: message.sid,
        from_number: message.from,
        to_number: message.to,
        direction: message.direction,
        body: message.body,
        status: message.status,
        error_code: message.errorCode || null,
        error_message: message.errorMessage || null,
        num_segments: message.numSegments || 1,
        price: message.price ? parseFloat(message.price) : null,
        price_unit: message.priceUnit || 'USD',
        from_city: null, // Twilio doesn't provide this for SMS
        from_state: null,
        from_country: null,
        to_city: null,
        to_state: null,
        to_country: null,
        media_urls: message.numMedia > 0 ? this.getMediaUrls(message) : null,
        sent_at: message.dateSent,
        delivered_at: message.status === 'delivered' ? message.dateUpdated : null,
        created_at: message.dateCreated,
        updated_at: message.dateUpdated
      }));

      // Apply additional filtering if needed
      let filteredMessages = transformedMessages;

      if (status) {
        filteredMessages = filteredMessages.filter(msg => msg.status === status);
      }

      // Sort by creation date (newest first)
      filteredMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const paginatedMessages = filteredMessages.slice(startIndex, startIndex + limit);

      const result = {
        messages: paginatedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredMessages.length,
          pages: Math.ceil(filteredMessages.length / limit)
        }
      };

      this.setCache(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error fetching messages from Twilio:', error);
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }
  }

  async getMessage(messageSid) {
    const cacheKey = this.getCacheKey('message', { messageSid });
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const message = await this.client.messages(messageSid).fetch();

      const transformedMessage = {
        id: message.sid,
        message_sid: message.sid,
        from_number: message.from,
        to_number: message.to,
        direction: message.direction,
        body: message.body,
        status: message.status,
        error_code: message.errorCode || null,
        error_message: message.errorMessage || null,
        num_segments: message.numSegments || 1,
        price: message.price ? parseFloat(message.price) : null,
        price_unit: message.priceUnit || 'USD',
        from_city: null,
        from_state: null,
        from_country: null,
        to_city: null,
        to_state: null,
        to_country: null,
        media_urls: message.numMedia > 0 ? this.getMediaUrls(message) : null,
        sent_at: message.dateSent,
        delivered_at: message.status === 'delivered' ? message.dateUpdated : null,
        created_at: message.dateCreated,
        updated_at: message.dateUpdated
      };

      this.setCache(cacheKey, transformedMessage);
      return transformedMessage;

    } catch (error) {
      console.error('Error fetching message from Twilio:', error);
      throw new Error(`Failed to fetch message: ${error.message}`);
    }
  }

  // Get conversation with a specific phone number
  async getConversation(phoneNumber, options = {}) {
    const { page = 1, limit = 50 } = options;

    const cacheKey = this.getCacheKey('conversation', { phoneNumber, ...options });
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get messages both to and from the phone number
      const [inboundMessages, outboundMessages] = await Promise.all([
        this.client.messages.list({
          from: phoneNumber,
          to: this.phoneNumber,
          limit: 1000
        }),
        this.client.messages.list({
          from: this.phoneNumber,
          to: phoneNumber,
          limit: 1000
        })
      ]);

      // Combine and transform messages
      const allMessages = [...inboundMessages, ...outboundMessages].map(message => ({
        id: message.sid,
        message_sid: message.sid,
        from_number: message.from,
        to_number: message.to,
        direction: message.direction,
        body: message.body,
        status: message.status,
        error_code: message.errorCode || null,
        error_message: message.errorMessage || null,
        num_segments: message.numSegments || 1,
        price: message.price ? parseFloat(message.price) : null,
        price_unit: message.priceUnit || 'USD',
        media_urls: message.numMedia > 0 ? this.getMediaUrls(message) : null,
        sent_at: message.dateSent,
        delivered_at: message.status === 'delivered' ? message.dateUpdated : null,
        created_at: message.dateCreated,
        updated_at: message.dateUpdated
      }));

      // Sort chronologically (oldest first for conversation view)
      allMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      // Apply pagination
      const startIndex = (page - 1) * limit;
      const paginatedMessages = allMessages.slice(startIndex, startIndex + limit);

      const result = {
        phoneNumber,
        messages: paginatedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: allMessages.length,
          pages: Math.ceil(allMessages.length / limit)
        }
      };

      this.setCache(cacheKey, result);
      return result;

    } catch (error) {
      console.error('Error fetching conversation from Twilio:', error);
      throw new Error(`Failed to fetch conversation: ${error.message}`);
    }
  }

  // Get list of unique phone numbers we've had conversations with
  async getConversations() {
    const cacheKey = this.getCacheKey('conversations', {});
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get recent messages to find unique phone numbers
      const messages = await this.client.messages.list({ limit: 1000 });

      const phoneNumbers = new Set();
      const conversationData = new Map();

      messages.forEach(message => {
        const otherNumber = message.from === this.phoneNumber ? message.to : message.from;

        if (!phoneNumbers.has(otherNumber)) {
          phoneNumbers.add(otherNumber);
          conversationData.set(otherNumber, {
            phone_number: otherNumber,
            last_message_body: message.body,
            last_message_at: message.dateCreated,
            last_message_direction: message.direction,
            message_count: 1
          });
        } else {
          // Update if this message is more recent
          const existing = conversationData.get(otherNumber);
          if (new Date(message.dateCreated) > new Date(existing.last_message_at)) {
            conversationData.set(otherNumber, {
              phone_number: otherNumber,
              last_message_body: message.body,
              last_message_at: message.dateCreated,
              last_message_direction: message.direction,
              message_count: existing.message_count + 1
            });
          } else {
            // Just increment count
            existing.message_count += 1;
          }
        }
      });

      const conversations = Array.from(conversationData.values())
        .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

      this.setCache(cacheKey, conversations);
      return conversations;

    } catch (error) {
      console.error('Error fetching conversations from Twilio:', error);
      throw new Error(`Failed to fetch conversations: ${error.message}`);
    }
  }

  // Send SMS
  async sendSMS(to, body, mediaUrls = null) {
    try {
      const messageData = {
        to,
        from: this.phoneNumber,
        body,
        statusCallback: `${process.env.WEBHOOK_BASE_URL}/webhooks/sms/status`,
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

  // Helper method to get media URLs from a message
  getMediaUrls(message) {
    const mediaUrls = [];
    for (let i = 0; i < message.numMedia; i++) {
      if (message[`mediaUrl${i}`]) {
        mediaUrls.push(message[`mediaUrl${i}`]);
      }
    }
    return mediaUrls.length > 0 ? mediaUrls : null;
  }
}

// Create singleton instance
const twilioService = new TwilioService();

// Clear expired cache every minute
setInterval(() => {
  twilioService.clearExpiredCache();
}, 60000);

module.exports = twilioService;
