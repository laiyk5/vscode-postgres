import * as https from 'https';
import { Global } from './global';

"use strict";

export async function chatWithOpenAI(prompt: string, model: string = 'gpt-3.5-turbo'): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || Global.Configuration.get('openaiApiKey');
  if (!apiKey) {
    throw new Error('OpenAI API key not set. Set OPENAI_API_KEY environment variable or vscode-postgres.openaiApiKey configuration.');
  }

  const payload = JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800
  });

  const options: https.RequestOptions = {
    hostname: 'api.chatanywhere.tech',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  return new Promise<string>((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          // best-effort: extract chat completion content
          const content = parsed?.choices?.[0]?.message?.content;
          resolve(typeof content === 'string' ? content : JSON.stringify(parsed));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

export default chatWithOpenAI;
