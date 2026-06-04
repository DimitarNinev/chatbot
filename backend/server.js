import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import mongoose from 'mongoose';
import Conversation from './models/conversation.js';

dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch(err => {
    console.error(err);
  });

if (!process.env.GROQ_API_KEY) {
  throw new Error('GROQ_API_KEY is missing in .env');
}

const app = express();

const MODEL = 'llama-3.3-70b-versatile';

app.use(cors({
  origin: 'http://localhost:4200'
}));
app.use(express.json());

const PORT = process.env.PORT || 3000;

const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1'
});

app.get('/', (req, res) => {
  res.json({
    status: 'AI Chat Backend Running'
  });
});

app.get('/api/chat/:conversationId', async (req, res) => {

  const conversation =
    await Conversation.findOne({
      conversationId: req.params.conversationId
    });

  res.json({
    messages:
      conversation?.messages || []
  });

});

app.get('/api/chats', async (req, res) => {

  try {

    const chats =
      await Conversation.find()
        .sort({ updatedAt: -1 });

    res.json(chats);

  } catch (error) {

    res.status(500).json({
      error: error.message
    });

  }

});

app.delete('/api/chat/:conversationId',
  async (req, res) => {

    await Conversation.deleteOne({
      conversationId:
        req.params.conversationId
    });

    res.json({
      success: true
    });

  });

app.post('/api/chat', async (req, res) => {
  try {

    const { message, conversationId } = req.body;

    if (!message) {
      return res.status(400).json({
        error: 'Message is required'
      });
    }

    const chatId = conversationId || 'default';

    const conversation =
      await Conversation.findOne({
        conversationId: chatId
      });

    let messages = (conversation?.messages || []).map(({ role, content }) => ({
      role,
      content
    }));

    if (messages.length === 0) {
      messages.push({
        role: 'system',
        content: `
          You are a helpful AI assistant.
          Reply clearly and naturally.
        `
      });
    }

    messages.push({
      role: 'user',
      content: message
    });

    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
      frequency_penalty: 0.2,
    });

    const assistantReply =
      completion.choices[0].message.content;

    messages.push({
      role: 'assistant',
      content: assistantReply
    });

    if (messages.length > 20) {
      messages = [
        messages[0],
        ...messages.slice(-19)
      ];
    }

    const title =
      conversation?.title ||
      message.substring(0, 50);

    const savedConversation = await Conversation.findOneAndUpdate(
      {
        conversationId: chatId
      },
      {
        conversationId: chatId,
        title: conversation?.title || message.substring(0, 50),
        model: MODEL,
        messages
      },
      {
        upsert: true,
        returnDocument: 'after'
      }
    );

    res.json({
      success: true,
      conversationId: chatId,
      reply: assistantReply
    });

  } catch (error) {

    console.error(
      'GROQ ERROR:',
      error.response?.data || error.message || error
    );

    res.status(500).json({
      success: false,
      error: 'AI request failed'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});