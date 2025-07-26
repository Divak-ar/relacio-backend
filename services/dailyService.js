const axios = require('axios');
const { DAILY_CONSTANTS } = require('../constants');

class DailyService {
  constructor() {
    this.apiKey = process.env.DAILY_API_KEY;
    this.baseURL = DAILY_CONSTANTS.API_BASE_URL;
    this.headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async createRoom(callId, participants) {
    try {
      const roomConfig = {
        name: callId,
        properties: {
          ...DAILY_CONSTANTS.ROOM_CONFIG,
          exp: Math.floor(Date.now() / 1000) + (60 * 60 * 2) // 2 hours from now
        }
      };

      const response = await axios.post(
        `${this.baseURL}/rooms`,
        roomConfig,
        { headers: this.headers }
      );

      return {
        roomName: response.data.name,
        roomUrl: response.data.url,
        config: response.data.config
      };
    } catch (error) {
      throw new Error(`Failed to create Daily.co room: ${error.response?.data?.error || error.message}`);
    }
  }

  async deleteRoom(roomName) {
    try {
      await axios.delete(
        `${this.baseURL}/rooms/${roomName}`,
        { headers: this.headers }
      );
      return true;
    } catch (error) {
      // Don't throw error if room doesn't exist
      if (error.response?.status === 404) {
        return true;
      }
      throw new Error(`Failed to delete Daily.co room: ${error.response?.data?.error || error.message}`);
    }
  }

  async getRoomInfo(roomName) {
    try {
      const response = await axios.get(
        `${this.baseURL}/rooms/${roomName}`,
        { headers: this.headers }
      );

      return {
        name: response.data.name,
        url: response.data.url,
        config: response.data.config,
        createdAt: response.data.created_at
      };
    } catch (error) {
      throw new Error(`Failed to get room info: ${error.response?.data?.error || error.message}`);
    }
  }

  async generateRoomToken(roomName, userId, options = {}) {
    try {
      const tokenConfig = {
        properties: {
          ...DAILY_CONSTANTS.TOKEN_CONFIG,
          room_name: roomName,
          user_name: userId,
          ...options
        }
      };

      const response = await axios.post(
        `${this.baseURL}/meeting-tokens`,
        tokenConfig,
        { headers: this.headers }
      );

      return response.data.token;
    } catch (error) {
      throw new Error(`Failed to generate room token: ${error.response?.data?.error || error.message}`);
    }
  }

  async listRooms() {
    try {
      const response = await axios.get(
        `${this.baseURL}/rooms`,
        { headers: this.headers }
      );

      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to list rooms: ${error.response?.data?.error || error.message}`);
    }
  }

  async getRoomParticipants(roomName) {
    try {
      const response = await axios.get(
        `${this.baseURL}/rooms/${roomName}/participants`,
        { headers: this.headers }
      );

      return response.data.data;
    } catch (error) {
      throw new Error(`Failed to get room participants: ${error.response?.data?.error || error.message}`);
    }
  }

  async endMeeting(roomName) {
    try {
      await axios.post(
        `${this.baseURL}/rooms/${roomName}/end-meeting`,
        {},
        { headers: this.headers }
      );
      return true;
    } catch (error) {
      throw new Error(`Failed to end meeting: ${error.response?.data?.error || error.message}`);
    }
  }

  generateCallId() {
    return `relacio-call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = new DailyService();
