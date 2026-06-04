import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true
  },

  content: {
    type: String,
    required: true
  }
});

const ConversationSchema = new mongoose.Schema({

  conversationId: {
    type: String,
    required: true,
    unique: true
  },

  title: {
    type: String,
    default: 'New Chat'
  },

  model: {
    type: String,
    default: 'llama-3.3-70b-versatile'
  },

  messages: [MessageSchema]

}, {
  timestamps: true
});

export default mongoose.model(
  'Conversation',
  ConversationSchema
);