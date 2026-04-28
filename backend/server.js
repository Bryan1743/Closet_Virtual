require('dotenv').config();

console.log('[DEBUG] OPENROUTER_API_KEY loaded:', process.env.OPENROUTER_API_KEY ? 'YES (' + process.env.OPENROUTER_API_KEY.substring(0, 12) + '...)' : 'NOT FOUND');

const path = require('path');
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const { tops, bottoms } = require('./data/wardrobe');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/assets', express.static(path.join(__dirname, '../assets')));

const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});

const ANALYSIS_PROMPT = `Analyze this person's appearance and provide styling recommendations. Respond with valid JSON only, no markdown, no explanation. Use exactly these fields:
{
  skinTone: warm/cool/neutral + light/medium/deep e.g. 'warm medium',
  bodyType: rectangle/hourglass/inverted-triangle/triangle/oval,
  recommendedColors: array of 6 hex color codes,
  colorsDescription: array of 6 color names matching the hex codes,
  recommendedFits: array of 3-4 clothing fit recommendations,
  fabricsToFavor: array of 3-4 recommended fabrics,
  fabricsToAvoid: array of 3-4 fabrics to avoid,
  styleAdvice: 2-3 sentences of personalized style advice
}`;

app.get('/api/wardrobe', (req, res) => {
  res.json({ tops, bottoms });
});

app.get('/api/models', async (req, res) => {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
  });
  const data = await response.json();
  const freeVision = data.data.filter(m => 
    m.id.includes(':free') && 
    m.architecture && 
    m.architecture.modality && 
    m.architecture.modality.includes('image')
  );
  res.json(freeVision.map(m => ({ id: m.id, name: m.name })));
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { image } = req.body || {};
    if (!image || typeof image !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid "image" field. Expected a base64-encoded image string.' });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = image.startsWith('data:') ? image.match(/data:(image\/\w+);/)?.[1] || 'image/jpeg' : 'image/jpeg';

    const completion = await client.chat.completions.create({
      model: 'nvidia/nemotron-nano-12b-v2-vl:free',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYSIS_PROMPT },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
          ]
        }
      ],
    });

    const text = completion.choices[0].message.content.trim();
    
    let cleaned = text;
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    cleaned = cleaned.replace(/^```\s*[\s\S]*?```$/gi, '').trim();
    
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    let profile;
    try {
      profile = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[Analyze JSON Parse Error]:', parseErr.message, '| Raw:', text.substring(0, 200));
      profile = {
        skinTone: 'neutral medium',
        bodyType: 'rectangle',
        recommendedColors: ['#2D3436', '#636E72', '#B2BEC3', '#DFE6E9', '#74B9FF', '#A29BFE'],
        colorsDescription: ['Charcoal', 'Gray', 'Silver', 'Light Gray', 'Sky Blue', 'Lavender'],
        recommendedFits: ['Casual', 'Smart Casual', 'Athleisure'],
        fabricsToFavor: ['Cotton', 'Linen', 'Jersey'],
        fabricsToAvoid: ['Sequins', 'Velvet', 'Satin'],
        styleAdvice: 'Analysis unavailable. Try again with better lighting.',
        error: true
      };
    }

    res.json({ profile });
  } catch (err) {
    console.error('OpenRouter analysis error:', err.message);
    res.status(500).json({
      error: 'Failed to analyze image.',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

let storedAnalysis = null;

const wardrobeCatalog = tops.length || bottoms.length
  ? `\n\nYOU ONLY KNOW ABOUT THE FOLLOWING WARDROBE ITEMS. YOU CANNOT SUGGEST, MENTION, OR REFERENCE ANY CLOTHING ITEM THAT IS NOT IN THIS EXACT LIST. IF ASKED FOR AN OUTFIT AND THE AVAILABLE ITEMS ARE LIMITED, COMBINE ONLY WHAT EXISTS IN THE LIST AND SAY WHICH SPECIFIC ITEMS YOU ARE COMBINING BY THEIR EXACT NAME.\n\nTOPS:\n${tops.map(t => `- ${t.name} (${t.tag}, ${t.meta})`).join('\n')}\n\nBOTTOMS:\n${bottoms.map(b => `- ${b.name} (${b.tag}, ${b.meta})`).join('\n')}\n\nNEVER INVENT CLOTHING ITEMS. NEVER SUGGEST ACCESSORIES, SHOES, JEWELRY, OR ANY ITEM NOT IN THE WARDROBE LIST ABOVE. ONLY RECOMMEND COMBINATIONS OF THE EXACT ITEMS LISTED.`
  : '';

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, analysis, wardrobe, userName, userGender } = req.body || {};
    if (analysis) storedAnalysis = analysis;

    const personalAdviceKeywords = ['color', 'colours', 'colores', 'outfit', 'wear', 'style', 'body', 'skin', 'recommend', 'suggest', 'sugerir', 'recomentar', 'ropa', 'vestir', 'tipo', 'tono', 'favor', 'flattering', 'suits me', '适合', 'personalized', 'personal'];
    const msgLower = message.toLowerCase();
    const needsPersonalAdvice = personalAdviceKeywords.some(k => msgLower.includes(k));

    if (needsPersonalAdvice && (!analysis || !analysis.skinTone)) {
      return res.json({ success: true, reply: "I'd love to help with that! But first I need to see you - close this chat and click the 'Analyze Me' button to upload a photo of yourself. Once I analyze your skin tone and body type, I can give you truly personalized recommendations!" });
    }

    const nameGreeting = userName ? ` You are talking to ${userName}. Address them by name.` : '';

    const systemPrompt = storedAnalysis && storedAnalysis.skinTone
      ? `You are StyleAI, a very concise fashion assistant.${wardrobeCatalog}${nameGreeting}\n\nUser profile:\n- Skin Tone: ${storedAnalysis.skinTone}\n- Body Type: ${storedAnalysis.bodyType}\n- Recommended Colors: ${storedAnalysis.recommendedColors?.join(', ')}\n- Recommended Fits: ${storedAnalysis.recommendedFits?.join(', ')}\n\nRESPONSE RULES: Max 3-4 lines. No bullet points over 1 line. No extra tips. No quotes. No sign-off.`
      : `You are StyleAI, a very concise fashion assistant.${wardrobeCatalog}${nameGreeting}\n\nRESPONSE RULES: Max 3-4 lines. No bullet points over 1 line. No extra tips. No quotes. No sign-off.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []),
      { role: 'user', content: message }
    ];

    const completion = await client.chat.completions.create({
      model: 'nvidia/nemotron-nano-12b-v2-vl:free',
      messages,
    });

    res.json({ success: true, reply: completion.choices[0].message.content.trim() });
  } catch (err) {
    console.error('OpenRouter chat error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Wardrobe backend listening on port ${PORT}`);
});