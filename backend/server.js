import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

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

const conversations = new Map();

app.get('/', (req, res) => {
  res.json({
    status: 'AI Chat Backend Running'
  });
});

app.get('/api/model', (req, res) => {
  res.json({
    model: MODEL
  });
});

app.get('/api/chat/:conversationId', (req, res) => {

  const { conversationId } = req.params;

  const messages =
    conversations.get(conversationId) || [];

  res.json({
    messages
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

    // history
    let messages = conversations.get(chatId) || [];

    // system prompt
    if (messages.length === 0) {
      messages.push({
        role: 'system',
        content: `
          You are a helpful AI assistant.
          Reply clearly and naturally.
        `
      });
    }

    // user message
    messages.push({
      role: 'user',
      content: message
    });

    // OpenAI request
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 2000
    });

    const assistantReply =
      completion.choices[0].message.content;

    // save assistant response
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

    // save conversation
    conversations.set(chatId, messages);

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

app.delete('/api/chat/:conversationId', (req, res) => {

  const { conversationId } = req.params;

  const deleted =
    conversations.delete(conversationId);

  res.json({
    success: deleted
  });

});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});