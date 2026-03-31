const express = require('express');
const cors = require('cors');
const { tops, bottoms } = require('./data/wardrobe');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));

app.get('/api/wardrobe', (req, res) => {
  res.json({ tops, bottoms });
});

app.post('/api/analyze', (req, res) => {
  const { image } = req.body || {};
  const profile = {
    skinTone: "medium",
    bodyType: "average",
    recommendedColors: ["navy", "olive", "charcoal", "sand"],
    recommendedFits: ["slim", "regular"]
  };
  res.json({ profile, receivedImage: typeof image === 'string' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Wardrobe backend listening on port ${PORT}`);
});
