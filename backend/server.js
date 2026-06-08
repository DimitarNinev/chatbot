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

app.get('/api/model', (req, res) => {
  res.json({
    model: MODEL
  });
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

const SYSTEM_PROMPT = `
                        You are a professional AI assistant.

                        IMPORTANT FORMATTING RULES:

                        - Always answer in Markdown.
                        - Use headings when appropriate.
                        - Use bullet lists for enumerations.
                        - Use numbered lists for steps.
                        - Separate ideas into paragraphs.
                        - Never write large walls of text.
                        - Never return plain text lists separated only by commas.
                        - Format recipes, instructions and explanations with clear structure.

                        Answer in the same language as the user.
                      `
;

const SYSTEM_TITLE_PROMPT = `
                              Generate a chat title.
                              Max 5 words.
                              Return only the title.
                              Use same language.
                              No punctuation.
                            `
;

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

async function generateChatTitle(userMessage, assistantReply) {
  try {

    const titleCompletion =
      await openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: SYSTEM_TITLE_PROMPT
          },
          {
            role: 'user',
            content: `
                      User:
                      ${userMessage}

                      Assistant:
                      ${assistantReply}
                     `
          }
        ],
        temperature: 0.3,
        max_tokens: 20
      });

    return titleCompletion.choices[0].message.content.trim();

  } catch (error) {

    console.error('TITLE ERROR:', error);

    return userMessage.substring(0, 40);

  }
}

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

    let messages = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      ...(conversation?.messages || [])
        .filter(m => m.role !== 'system')
        .map(({ role, content }) => ({
          role,
          content
        }))
    ];

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

    let title =
      conversation?.title || 'New Chat';

    const isNewConversation =
      !conversation;

    if (isNewConversation) {

      title = await generateChatTitle(
        message,
        assistantReply
      );

    }

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

    const savedConversation = await Conversation.findOneAndUpdate(
      {
        conversationId: chatId
      },
      {
        conversationId: chatId,
        title,
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