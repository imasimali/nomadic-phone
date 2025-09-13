const twilio = require('twilio');

class TwilioService {
  constructor() {
    this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
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

  // Get all recordings
  async getRecordings(options = {}) {
    const { limit = 20 } = options;

    try {
      const twilioOptions = {
        limit: Math.min(limit, 50),
      };

      const recordings = await this.client.recordings.list(twilioOptions);

      // For each recording, fetch the associated call details
      const recordingsWithCallDetails = await Promise.all(
        recordings.map(async (recording) => {
          try {
            // Fetch call details for this recording
            const call = await this.client.calls(recording.callSid).fetch();

            return {
              id: recording.sid,
              recording_sid: recording.sid,
              call_sid: recording.callSid,
              duration: recording.duration ? parseInt(recording.duration) : null,
              recording_duration: recording.duration ? parseInt(recording.duration) : null,
              status: recording.status,
              recording_url: `/api/voice/recordings/${recording.sid}`, // Use our proxy endpoint
              uri: recording.uri,
              date_created: recording.dateCreated,
              date_updated: recording.dateUpdated,
              created_at: recording.dateCreated,
              updated_at: recording.dateUpdated,
              // Call details
              from_number: call.from,
              to_number: call.to,
              direction: call.direction,
              call_status: call.status,
              call_duration: call.duration ? parseInt(call.duration) : null,
              start_time: call.startTime,
              end_time: call.endTime
            };
          } catch (callError) {
            console.warn(`Could not fetch call details for recording ${recording.sid}:`, callError.message);
            // Return recording without call details if call fetch fails
            return {
              id: recording.sid,
              recording_sid: recording.sid,
              call_sid: recording.callSid,
              duration: recording.duration ? parseInt(recording.duration) : null,
              recording_duration: recording.duration ? parseInt(recording.duration) : null,
              status: recording.status,
              recording_url: `/api/voice/recordings/${recording.sid}`,
              uri: recording.uri,
              date_created: recording.dateCreated,
              date_updated: recording.dateUpdated,
              created_at: recording.dateCreated,
              updated_at: recording.dateUpdated,
              // Default values when call details are unavailable
              from_number: 'Unknown',
              to_number: 'Unknown',
              direction: 'unknown',
              call_status: 'unknown',
              call_duration: null,
              start_time: null,
              end_time: null
            };
          }
        })
      );

      // Sort by creation date (newest first)
      recordingsWithCallDetails.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return {
        recordings: recordingsWithCallDetails,
        pagination: {
          page: 1,
          limit: recordingsWithCallDetails.length,
          total: recordingsWithCallDetails.length,
          pages: 1
        }
      };

    } catch (error) {
      console.error('Error fetching recordings from Twilio:', error);
      throw new Error(`Failed to fetch recordings: ${error.message}`);
    }
  }

  // Get a specific recording
  async getRecording(recordingSid) {
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

      // Always filter by our phone number to ensure we only get messages to/from our number
      if (this.phoneNumber) {
        if (direction === 'inbound') {
          twilioOptions.to = this.phoneNumber;
        } else if (direction === 'outbound') {
          twilioOptions.from = this.phoneNumber;
        } else {
          // When no direction is specified, we need to get both inbound and outbound
          // We'll fetch both and combine them
        }
      }

      let messages;
      if (!direction && this.phoneNumber) {
        // Fetch both inbound and outbound messages separately
        const [inboundMessages, outboundMessages] = await Promise.all([
          this.client.messages.list({ ...twilioOptions, to: this.phoneNumber }),
          this.client.messages.list({ ...twilioOptions, from: this.phoneNumber })
        ]);
        messages = [...inboundMessages, ...outboundMessages];
      } else {
        messages = await this.client.messages.list(twilioOptions);
      }

      // Transform messages and ensure correct direction
      const transformedMessages = messages.map(message => {
        // Determine direction based on our phone number
        let messageDirection = message.direction;
        if (this.phoneNumber) {
          if (message.from === this.phoneNumber) {
            messageDirection = 'outbound';
          } else if (message.to === this.phoneNumber) {
            messageDirection = 'inbound';
          }
        }

        return {
          id: message.sid,
          message_sid: message.sid,
          from_number: message.from,
          to_number: message.to,
          direction: messageDirection,
          body: message.body,
          status: message.status,
          created_at: message.dateCreated,
          updated_at: message.dateUpdated
        };
      });

      // Remove duplicates (in case a message appears in both inbound and outbound lists)
      const uniqueMessages = transformedMessages.reduce((acc, message) => {
        if (!acc.find(m => m.message_sid === message.message_sid)) {
          acc.push(message);
        }
        return acc;
      }, []);

      // Sort by creation date (newest first)
      uniqueMessages.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      return {
        messages: uniqueMessages,
        pagination: {
          page: 1,
          limit: uniqueMessages.length,
          total: uniqueMessages.length,
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
