// Debug OpenAI initialization in service context
require('dotenv').config();

async function debugOpenAIInit() {
  try {
    console.log('Debugging OpenAI initialization...');
    
    // Check environment variables
    console.log('OPENAI_API_KEY present:', !!process.env.OPENAI_API_KEY);
    console.log('OPENAI_API_KEY length:', process.env.OPENAI_API_KEY?.length || 0);
    console.log('OPENAI_MODEL:', process.env.OPENAI_MODEL);
    
    // Try importing the config
    const configPath = './src/config/index.ts';
    console.log('Importing config from:', configPath);
    
    // Since we can't directly import TS, let's check the config structure
    console.log('Config values:');
    console.log('- API Key exists:', !!process.env.OPENAI_API_KEY);
    console.log('- Model:', process.env.OPENAI_MODEL || 'o4-mini');
    
    // Test OpenAI initialization directly
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    console.log('✅ OpenAI client created successfully');
    
    // Test a simple call
    const completion = await openai.chat.completions.create({
      model: 'o4-mini',
      messages: [
        { role: 'system', content: 'Reply with JSON: {"status": "working"}' },
        { role: 'user', content: 'Test' }
      ],
      response_format: { type: 'json_object' }
    });
    
    console.log('✅ OpenAI API call successful:', JSON.parse(completion.choices[0].message.content));
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  }
}

debugOpenAIInit();