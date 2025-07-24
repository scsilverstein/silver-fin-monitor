// Simple OpenAI test to verify parameters work with o4-mini
const OpenAI = require('openai');
require('dotenv').config();

async function testSimpleOpenAI() {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    console.log('Testing simple OpenAI call with o4-mini...');
    
    const completion = await openai.chat.completions.create({
      model: 'o4-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Respond with valid JSON containing a "message" field.'
        },
        {
          role: 'user',
          content: 'Say hello in JSON format'
        }
      ],
      response_format: { type: 'json_object' }
    });

    const response = JSON.parse(completion.choices[0].message.content);
    console.log('✅ OpenAI response:', response);
    
  } catch (error) {
    console.error('❌ OpenAI test failed:', error.message);
  }
}

testSimpleOpenAI();