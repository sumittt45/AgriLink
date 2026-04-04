import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Mic } from "lucide-react";

const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY as string;

type Language =
  | "English" | "Hindi" | "Bengali" | "Marathi"
  | "Tamil" | "Telugu" | "Kannada" | "Malayalam"
  | "Gujarati" | "Punjabi";

interface LangOption {
  value: Language;
  label: string;   // native script
  flag: string;
}

const LANGUAGES: LangOption[] = [
  { value: "English",   label: "English",    flag: "🇬🇧" },
  { value: "Hindi",     label: "हिंदी",       flag: "🇮🇳" },
  { value: "Bengali",   label: "বাংলা",       flag: "🇮🇳" },
  { value: "Marathi",   label: "मराठी",       flag: "🇮🇳" },
  { value: "Tamil",     label: "தமிழ்",       flag: "🇮🇳" },
  { value: "Telugu",    label: "తెలుగు",      flag: "🇮🇳" },
  { value: "Kannada",   label: "ಕನ್ನಡ",       flag: "🇮🇳" },
  { value: "Malayalam", label: "മലയാളം",      flag: "🇮🇳" },
  { value: "Gujarati",  label: "ગુજરાતી",     flag: "🇮🇳" },
  { value: "Punjabi",   label: "ਪੰਜਾਬੀ",      flag: "🇮🇳" },
];

const WELCOME: Record<Language, string> = {
  English:   "Hi! I'm AgriChat 🌱 Ask me about crops, prices, orders, or farming tips. How can I help?",
  Hindi:     "नमस्ते! मैं AgriChat 🌱 हूँ। फसल, भाव, ऑर्डर या खेती की सलाह — क्या जानना है?",
  Bengali:   "নমস্কার! আমি AgriChat 🌱। ফসল, দাম, অর্ডার বা কৃষি পরামর্শ — কী জানতে চান?",
  Marathi:   "नमस्कार! मी AgriChat 🌱 आहे। पीक, भाव, ऑर्डर किंवा शेतीचा सल्ला — काय जाणून घ्यायचे आहे?",
  Tamil:     "வணக்கம்! நான் AgriChat 🌱. பயிர்கள், விலைகள், ஆர்டர்கள் அல்லது விவசாய குறிப்புகள் — என்ன தெரிந்துகொள்ள வேண்டும்?",
  Telugu:    "నమస్కారం! నేను AgriChat 🌱. పంటలు, ధరలు, ఆర్డర్లు లేదా వ్యవసాయ చిట్కాలు — మీకు ఏమి కావాలి?",
  Kannada:   "ನಮಸ್ಕಾರ! ನಾನು AgriChat 🌱. ಬೆಳೆ, ಬೆಲೆ, ಆರ್ಡರ್ ಅಥವಾ ಕೃಷಿ ಸಲಹೆ — ಏನು ತಿಳಿಯಬೇಕು?",
  Malayalam: "നമസ്കാരം! ഞാൻ AgriChat 🌱 ആണ്. വിളകൾ, വില, ഓർഡർ അല്ലെങ്കിൽ കൃഷി നുറുങ്ങുകൾ — എന്ത് അറിയണം?",
  Gujarati:  "નમસ્તે! હું AgriChat 🌱 છું. પાક, ભાવ, ઓર્ડર અથવા ખેતીની સલાહ — શું જાણવું છે?",
  Punjabi:   "ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ AgriChat 🌱 ਹਾਂ। ਫ਼ਸਲ, ਭਾਅ, ਆਰਡਰ ਜਾਂ ਖੇਤੀ ਸਲਾਹ — ਕੀ ਜਾਣਨਾ ਹੈ?",
};

const LANG_CODES: Record<Language, string> = {
  English: "en-IN", Hindi: "hi-IN", Bengali: "bn-IN", Marathi: "mr-IN",
  Tamil: "ta-IN", Telugu: "te-IN", Kannada: "kn-IN",
  Malayalam: "ml-IN", Gujarati: "gu-IN", Punjabi: "pa-IN",
};

const PLACEHOLDER: Record<Language, string> = {
  English:   "Ask about crops, prices, orders...",
  Hindi:     "फसल, भाव, ऑर्डर के बारे में पूछें...",
  Bengali:   "ফসল, দাম, অর্ডার সম্পর্কে জিজ্ঞেস করুন...",
  Marathi:   "पीक, भाव, ऑर्डर बद्दल विचारा...",
  Tamil:     "பயிர், விலை, ஆர்டர் பற்றி கேளுங்கள்...",
  Telugu:    "పంటలు, ధరలు, ఆర్డర్ గురించి అడగండి...",
  Kannada:   "ಬೆಳೆ, ಬೆಲೆ, ಆರ್ಡರ್ ಬಗ್ಗೆ ಕೇಳಿ...",
  Malayalam: "വിള, വില, ഓർഡർ എന്നിവ ചോദിക്കൂ...",
  Gujarati:  "પાક, ભાવ, ઓર્ડર વિશે પૂછો...",
  Punjabi:   "ਫ਼ਸਲ, ਭਾਅ, ਆਰਡਰ ਬਾਰੇ ਪੁੱਛੋ...",
};

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
}

async function askGemini(question: string, language: Language): Promise<string> {
  if (!GEMINI_KEY) throw new Error("VITE_GEMINI_API_KEY is not set in .env");

  const prompt = `You are AgriChat 🌱 — the official AI assistant of AgriLink, an Indian agriculture B2C/B2B marketplace that connects farmers directly with buyers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 AGRILINK APP — COMPLETE GUIDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AgriLink is a React + Supabase app. Here is everything users can do:

HOME PAGE:
- Browse trending crops, fresh deals, and seasonal produce
- See local farmer picks and smart features
- Search for specific crops using the search bar

CATEGORIES:
- Browse crops by category (vegetables, fruits, grains, spices, etc.)
- Filter by price, location, and availability

MARKETPLACE / BULK MARKETPLACE:
- Buy crops in bulk directly from farmers
- Bulk discounts: 5% off for 5–9 kg, 10% off for 10–24 kg, 15% off for 25+ kg
- View farmer profiles and ratings

CART:
- Add items to cart with quantity selection
- View subtotal, bulk discount, and delivery fee (free above ₹500)
- Proceed to checkout

CHECKOUT:
- Choose payment: Razorpay (UPI/Card/Netbanking) or Cash on Delivery
- Enter delivery address
- Place order securely

ORDERS:
- View all past and current orders
- Track order status: Processing → Confirmed → Packed → Out for Delivery → Delivered
- Cancel order within 3 hours of placing it (pending orders only)
- View order details: items, invoice, delivery address, payment method

FARMERS SECTION:
- Browse available local farmers
- View farm profiles, crop listings, and prices
- Contact farmers directly

FARMER PORTAL (for sellers):
- Register as a farmer with Aadhaar/government ID
- List your crops with price, quantity, and description
- Manage orders and earnings via Farmer Dashboard
- Track buyer requests and quotes

AI FEATURES:
- AI Crop Prediction: predict best crops based on soil, weather, location
- AI Crop Forecast: price forecasting and market trend analysis
- AI Insights: data-driven advice on when to sell and at what price

QUICK ORDER:
- Fast ordering for regular buyers
- Pre-filled details for repeat purchases

PROFILE:
- Manage personal info, delivery addresses
- View order history and account settings

CHAT PAGE:
- Message farmers directly
- Negotiate prices and discuss bulk orders

ADMIN PANEL (admin only):
- User management, order analytics
- Full profile inspector for farmers and buyers

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🌾 INDIAN AGRICULTURE — COMPLETE KNOWLEDGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MAJOR CROPS & SEASONS:
- Kharif (June–Oct): Rice, Maize, Cotton, Soybean, Groundnut, Bajra, Jowar
- Rabi (Oct–Mar): Wheat, Mustard, Gram, Barley, Peas, Lentils
- Zaid (Mar–June): Watermelon, Muskmelon, Cucumber, Vegetables

TOP FARMING STATES:
- Punjab, Haryana: Wheat, Rice (Green Revolution belt)
- UP: Sugarcane, Wheat, Potatoes
- Maharashtra: Cotton, Sugarcane, Onion, Grapes
- AP & Telangana: Rice, Chilli, Tobacco
- Karnataka: Coffee, Ragi, Coconut, Silk
- Kerala: Rubber, Coconut, Spices, Tea
- Gujarat: Groundnut, Cotton, Cumin
- Rajasthan: Mustard, Bajra, Guar
- West Bengal: Rice, Jute, Tea
- Tamil Nadu: Rice, Banana, Turmeric

SOIL TYPES IN INDIA:
- Alluvial soil (Indo-Gangetic plain): Most fertile, best for wheat, rice
- Black/Regur soil (Deccan): Best for cotton
- Red & Yellow soil (Peninsular India): Groundnut, millet
- Laterite soil (Hills): Tea, coffee, cashew
- Arid/Desert soil (Rajasthan): Bajra, drought-resistant crops
- Saline/Alkaline soil: Needs reclamation; rice tolerates salinity

IRRIGATION SYSTEMS:
- Canal irrigation (Punjab, Haryana, UP)
- Drip irrigation (Maharashtra, Gujarat, Karnataka)
- Sprinkler irrigation (Rajasthan, MP)
- Tube wells & borewells (most states)
- Rainwater harvesting & check dams

FERTILIZERS & NUTRIENTS:
- NPK (Nitrogen, Phosphorus, Potassium) — most important
- Urea: main nitrogen source
- DAP: Diammonium Phosphate — widely used
- Potash (MOP): for root development
- Organic: compost, vermicompost, green manure, FYM
- Micronutrients: Zinc, Boron, Sulfur deficiencies common in India

PEST & DISEASE MANAGEMENT:
- IPM (Integrated Pest Management) recommended
- Common pests: stem borer, aphids, whitefly, bollworm, locust
- Common diseases: blast (rice), rust (wheat), powdery mildew, wilt
- Bio-pesticides: Neem-based, Bacillus thuringiensis (Bt)
- Chemical: Chlorpyrifos, Monocrotophos (use carefully, follow guidelines)

CROP PRICES (MSP 2024-25, approximate):
- Wheat: ₹2,275/quintal
- Rice (Common): ₹2,300/quintal
- Maize: ₹2,090/quintal
- Soybean: ₹4,892/quintal
- Cotton (Medium): ₹7,121/quintal
- Groundnut: ₹6,783/quintal
- Mustard: ₹5,650/quintal
- Sugarcane (FRP): ₹340/quintal
- Arhar (Tur Dal): ₹7,550/quintal
- Moong: ₹8,682/quintal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏛️ GOVERNMENT SCHEMES FOR FARMERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PM-KISAN (Pradhan Mantri Kisan Samman Nidhi)
   - ₹6,000/year direct to farmer bank account in 3 installments
   - All landholding farmers eligible
   - Register at pmkisan.gov.in

2. PM Fasal Bima Yojana (PMFBY)
   - Crop insurance for natural disasters, pests, disease
   - Premium: 2% for Kharif, 1.5% for Rabi, 5% for horticulture
   - Claims settled via satellite/drone surveys

3. Kisan Credit Card (KCC)
   - Short-term credit up to ₹3 lakh at 4% interest (after subsidy)
   - For seeds, fertilizers, equipment, crop needs
   - Available at all nationalized banks, cooperative banks

4. PM Krishi Sinchayee Yojana (PMKSY)
   - "Har Khet Ko Pani, More Crop Per Drop"
   - Funds for drip/sprinkler irrigation
   - 55% subsidy for small/marginal farmers

5. Soil Health Card Scheme
   - Free soil testing at government centers
   - 12 nutrient parameters tested
   - Crop-specific fertilizer recommendations

6. e-NAM (National Agriculture Market)
   - Online mandi platform connecting farmers to buyers across India
   - Better price discovery, reduces middlemen
   - 1,000+ mandis connected across states

7. PM Kisan Maandhan Yojana
   - Pension scheme: ₹3,000/month after age 60
   - Premium ₹55–₹200/month (age-based)
   - For small/marginal farmers

8. NABARD (National Bank for Agriculture & Rural Development)
   - Refinance to banks for agricultural loans
   - Supports FPOs, self-help groups (SHGs)
   - Rural infrastructure funding

9. Paramparagat Krishi Vikas Yojana (PKVY)
   - Promotes organic farming
   - ₹50,000/hectare assistance over 3 years
   - Cluster-based approach (50 farmers per cluster)

10. Agriculture Infrastructure Fund (AIF)
    - ₹1 lakh crore fund for post-harvest infrastructure
    - Cold storage, warehouses, sorting/grading units
    - 3% interest subvention on loans

11. PM Kisan Urja Suraksha evam Utthaan Mahabhiyan (KUSUM)
    - Solar pumps for irrigation
    - 60% subsidy on solar pump installation
    - Farmers can sell extra solar power to grid

12. Gramin Bhandaran Yojana
    - Subsidized rural warehousing/cold storage
    - Prevents distress selling post-harvest
    - Negotiable Warehouse Receipts (NWR) for loans

13. FPO Scheme (Farmer Producer Organizations)
    - 10,000 new FPOs formed by 2027
    - ₹18 lakh equity grant per FPO
    - Collective bargaining, better market access

14. Rashtriya Krishi Vikas Yojana (RKVY)
    - State-level agriculture development funding
    - Infrastructure, technology, training

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💼 AGRICULTURE BUSINESS IN INDIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SUPPLY CHAIN:
Farmer → Mandi (APMC) → Wholesaler → Retailer → Consumer
- APMCs (Agricultural Produce Market Committees) regulate trading
- Farm-to-fork direct selling via apps like AgriLink cuts 2–3 middlemen

MANDI SYSTEM:
- Mandis charge 1–3% commission (arhatiya)
- MSP is floor price; actual price determined by auction
- Digital mandis via e-NAM improving transparency

EXPORT OPPORTUNITIES:
- India exports: Basmati rice, spices, fresh vegetables, tea, coffee, cotton
- Key markets: UAE, USA, Bangladesh, Saudi Arabia, China
- APEDA (Agricultural & Processed Food Products Export Development Authority) supports exporters

AGRI STARTUPS & TECH:
- Precision farming using IoT sensors and drones
- AI-based crop advisory (like AgriLink's AI features)
- Blockchain for supply chain traceability
- Marketplace apps connecting farmers directly to consumers

POST-HARVEST:
- 15–20% of produce wasted due to poor storage/transport
- Cold chain infrastructure growing rapidly
- Government funding via AIF for cold storage

FINANCING:
- Crop loans at 7% (4% with Kisan Credit Card subsidy)
- MUDRA loans for agri-allied businesses
- Startup India for agri-tech ventures

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🐛 CROP PROBLEM SOLVER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When a farmer describes a crop problem, always follow this structure:
1. Identify the likely cause (pest / disease / deficiency / weather)
2. Give immediate action steps
3. Recommend treatment (organic first, then chemical)
4. Tell where to get the solution (Krishi Kendra, agriculture shop, online)
5. Preventive tips for next season

COMMON PEST PROBLEMS & SOLUTIONS:

Keede / Insects / Kida lagana (general):
- Spray Neem oil (5 ml/litre water) — safe, organic
- Yellow sticky traps for flying insects
- Chlorpyrifos 20 EC @ 2 ml/litre for heavy infestation
- Contact nearest Krishi Vigyan Kendra (KVK) for free diagnosis

Safed makdi / Whitefly (tomato, chilli, cotton):
- Yellow sticky traps
- Imidacloprid 17.8 SL @ 0.3 ml/litre spray
- Remove heavily infested leaves

Maahu / Aphids (wheat, mustard, vegetables):
- Spray soapy water (5g soap/litre)
- Dimethoate 30 EC @ 1.5 ml/litre
- Natural enemy: ladybird beetles — don't spray unnecessarily

Tana borer / Stem borer (rice, sugarcane, maize):
- Carbofuran 3G granules @ 20 kg/ha in soil
- Cartap hydrochloride 50 SP @ 1g/litre spray
- Pheromone traps for monitoring

Bollworm (cotton, tomato):
- Bacillus thuringiensis (Bt) spray — organic
- Spinosad 45 SC @ 0.3 ml/litre
- Destroy affected bolls/fruits

Tikka / Leaf spot / Jhulsa (peanut, wheat, rice):
- Mancozeb 75 WP @ 2.5g/litre spray
- Remove infected leaves, improve air circulation
- Avoid overhead irrigation

Powdery mildew / Safed churn (vegetables, grapes):
- Sulfur 80 WP @ 2g/litre spray
- Karathane (Dinocap) @ 1 ml/litre
- Avoid excess nitrogen fertilizer

Blast / Rice blast:
- Tricyclazole 75 WP @ 0.6g/litre
- Spray at booting stage
- Avoid excess urea

Wilt / Murjhana / Ulta sukhna:
- Usually fungal or bacterial — drench soil with Carbendazim 1g/litre
- Remove and destroy infected plants
- Improve drainage, avoid waterlogging

Yellow leaves / Peeli patti:
- Nitrogen deficiency: Apply Urea 5g/litre foliar spray
- Iron deficiency: Ferrous sulphate 0.5% spray
- Zinc deficiency: Zinc sulphate 0.5% spray
- Get soil tested at Krishi Kendra for accurate diagnosis

Fruit/vegetable not growing well / Poor yield:
- Check soil pH (ideal 6–7.5)
- Apply DAP at flowering stage
- Ensure proper irrigation — neither overwatering nor drought
- Boron deficiency common in fruit crops — spray Borax 0.2%

Crop burnt / Jali hui fasal (heat/frost):
- Heat stress: Mulching, irrigation at evening, shade nets
- Frost: Light irrigation before frost, smoke/fire method
- Apply potassium spray to help recovery

ANIMAL/BIRD DAMAGE:
- Nilgai, neelgai: Trench + thorny hedge boundary
- Birds: Reflective tape, scarecrow, net covering
- Rats/rodents: Zinc phosphide bait (careful, toxic), cats, owl boxes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏪 WHERE TO GET RESOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FERTILIZERS & PESTICIDES:
- Local licensed agriculture input shop (every block/tehsil has one)
- Government cooperative: IFFCO, KRIBHCO, NFL dealers
- Online: BigHaat, DeHaat, Bighaat, AgroStar app
- PACS (Primary Agricultural Credit Society) — subsidized rates
- Tell them your crop, soil type, and problem for best advice

SEEDS:
- Government certified seed centers (NSC — National Seeds Corporation)
- State Seeds Corporation (e.g., RSSC, MSSC, UPSSSC)
- Private: Mahyco, Pioneer, Syngenta, Bayer dealers
- KVK (Krishi Vigyan Kendra) — free/subsidized seeds for trials
- NFSM seed minikits free from agriculture department

SOIL TESTING:
- Nearest Soil Testing Lab (government — usually at district level)
- Mobile soil testing vans in many states
- KVK: free testing + recommendation
- Soil Health Card online: soilhealth.dac.gov.in

IRRIGATION EQUIPMENT (drip/sprinkler):
- State agriculture department office for subsidy forms
- PMKSY portal: pmksy.gov.in
- Local drip dealers: Jain Irrigation, Netafim, Finolex dealers
- 55% subsidy for small/marginal farmers

LOAN & CREDIT:
- Nearest nationalized bank / cooperative bank for KCC
- PM-KISAN: pmkisan.gov.in — check payment status
- NABARD office for FPO/SHG support
- Common Service Centre (CSC/Jan Seva Kendra) — help with applications

MARKET / MANDI:
- Nearest APMC mandi — check state agriculture department website
- e-NAM: enam.gov.in — register and sell online
- AgriLink: sell directly to buyers, no middleman
- Farmer helpline: 1800-180-1551 (free, all states)

EXPERT ADVICE / GUIDANCE:
- Kisan Call Centre: 1800-180-1551 (free, 24x7, in local language)
- KVK (Krishi Vigyan Kendra): free field visits, demos, training
- State agriculture department: block-level agriculture officer
- ICAR regional institutes for advanced research queries
- AgriLink's AgriChat — always available!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛒 BUYER PROBLEMS & SOLUTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Can't find a specific crop:
- Use Search on AgriLink home page
- Browse Categories section
- Check Bulk Marketplace for wholesale quantities

Price too high:
- Buy in bulk (5kg+) for automatic discount on AgriLink
- Check "Fresh Deals" section on home page
- Compare prices from different farmers in marketplace

Order not delivered / delayed:
- Check order status in Orders section
- Contact farmer directly via Chat page
- Raise issue — orders typically delivered within 2–3 days

Want to buy directly from a farmer:
- Go to Available Farmers or Farm Profile page
- Send price request or message via Chat
- Negotiate bulk prices directly

Payment failed:
- Retry with different payment method (UPI/Card/COD)
- Check internet connection
- COD is always available as backup

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PERSONALITY & RESPONSE RULES:
- You are like a knowledgeable friend who is also a farming expert
- Always respond in ${language} — if user writes in Hindi/mixed, respond in same style
- Be empathetic first ("Ye aam samasya hai, ghabrao mat") then give solution
- Give SPECIFIC, ACTIONABLE steps — not vague advice
- Always mention at least one free/affordable option
- If problem is serious (crop failure, loan crisis), mention Kisan helpline 1800-180-1551
- For location-specific resources, ask which state/district to give precise guidance
- Use simple words, avoid technical jargon unless explaining it
- End with an encouraging line when farmer has a problem
- Keep answers structured with short paragraphs or bullet points

User question: ${question}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1200, temperature: 0.75 },
      }),
    }
  );

  if (!res.ok) {
    const errBody = await res.text();
    console.error("[AgriChat] Gemini API error", res.status, errBody);
    if (res.status === 429) {
      const busy = new Error("RATE_LIMITED");
      (busy as any).isRateLimit = true;
      throw busy;
    }
    throw new Error(`Gemini ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    console.error("[AgriChat] Unexpected response shape:", JSON.stringify(data));
    throw new Error("Empty response from Gemini");
  }
  return text;
}

export default function AgriChat() {
  const [isOpen, setIsOpen]       = useState(false);
  const [language, setLanguage]   = useState<Language | null>(null);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [isListening, setIsListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const finalTextRef = useRef("");
  const isListeningRef = useRef(false);
  const fromVoiceRef = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  const selectLanguage = (lang: Language) => {
    setLanguage(lang);
    setMessages([{ id: "welcome", role: "bot", text: WELCOME[lang] }]);
  };

  const reset = () => {
    window.speechSynthesis?.cancel();
    setIsOpen(false);
    setTimeout(() => { setLanguage(null); setMessages([]); setInput(""); }, 300);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading || !language) return;
    if (isListening) stopVoice();
    window.speechSynthesis?.cancel();

    const wasVoice = fromVoiceRef.current;
    fromVoiceRef.current = false;

    setMessages((p) => [...p, { id: `u${Date.now()}`, role: "user", text }]);
    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = "42px"; }
    setLoading(true);

    try {
      const reply = await askGemini(text, language);
      setMessages((p) => [...p, { id: `b${Date.now()}`, role: "bot", text: reply }]);
      if (wasVoice) speakReply(reply, language);
    } catch (err: any) {
      console.error("[AgriChat] send error:", err?.message ?? err);
      if (err?.isRateLimit) {
        setMessages((p) => [
          ...p,
          {
            id: `e${Date.now()}`,
            role: "bot",
            text: "🌱 AgriChat is currently busy. Please try again in a few moments.\n\n(Retry in 10–20 seconds)",
          },
        ]);
      } else {
        setMessages((p) => [
          ...p,
          { id: `e${Date.now()}`, role: "bot", text: "Something went wrong. Please try again." },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const stopVoice = () => {
    isListeningRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    finalTextRef.current = "";
    setIsListening(false);
  };

  const speakReply = (text: string, lang: Language) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    // Strip markdown so speech sounds natural
    const clean = text.replace(/\*+/g, "").replace(/#{1,6}\s/g, "").replace(/━+/g, "").trim();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = LANG_CODES[lang];
    // Pick best matching voice; fall back to hi-IN for Indian languages
    const voices = window.speechSynthesis.getVoices();
    const langCode = LANG_CODES[lang];
    const voice =
      voices.find((v) => v.lang === langCode) ||
      voices.find((v) => v.lang.startsWith(langCode.split("-")[0])) ||
      voices.find((v) => v.lang.startsWith("hi")) ||
      null;
    if (voice) utter.voice = voice;
    utter.rate = 1.0;
    window.speechSynthesis.speak(utter);
  };

  const startVoiceInput = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      // iOS Safari doesn't support Web Speech API
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      alert(isIOS
        ? "Voice input is not supported on iOS Safari. Please type your message."
        : "Voice input is not supported in this browser. Please use Chrome."
      );
      return;
    }
    if (isListening) { stopVoice(); return; }

    finalTextRef.current = "";
    isListeningRef.current = true;
    fromVoiceRef.current = true;
    setIsListening(true);

    const startSession = () => {
      if (!isListeningRef.current) return;
      const recognition = new SR();
      recognition.lang = language ? LANG_CODES[language] : "hi-IN";
      recognition.continuous = false;    // more reliable on Android
      recognition.interimResults = true;
      recognitionRef.current = recognition;

      recognition.onresult = (e: any) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            finalTextRef.current += e.results[i][0].transcript + " ";
          } else {
            interim = e.results[i][0].transcript;
          }
        }
        setInput((finalTextRef.current + interim).trim());
      };

      // Auto-restart on end so mic stays on (fixes Android stopping after silence)
      recognition.onend = () => {
        if (isListeningRef.current) startSession();
      };

      recognition.onerror = (e: any) => {
        // "no-speech" is normal on mobile — just restart, don't stop
        if (e.error === "no-speech" && isListeningRef.current) {
          startSession();
        } else {
          stopVoice();
        }
      };

      try { recognition.start(); } catch (_) { stopVoice(); }
    };

    startSession();
  };

  return (
    <>
      {/* ── FAB — only show when panel is closed ── */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open AgriChat"
          style={{
            position: "fixed", bottom: 80, right: 16,
            width: 52, height: 52, borderRadius: "50%",
            background: "#0c831f", color: "white", border: "none",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 18px rgba(12,131,31,0.45)",
            cursor: "pointer", zIndex: 1001, transition: "transform 0.15s",
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)")}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
        >
          <MessageCircle size={22} />
        </button>
      )}

      {/* ── Click-outside overlay (invisible) ── */}
      {isOpen && (
        <div
          onClick={reset}
          style={{ position: "fixed", inset: 0, zIndex: 999 }}
        />
      )}

      {/* ── Side panel ── */}
      <div className="agri-chat-panel" style={{
        position: "fixed",
        bottom: 90,
        right: 16,
        width: 360,
        height: 520,
        background: "#fff",
        borderRadius: 16,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
        pointerEvents: isOpen ? "auto" : "none",
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
        transformOrigin: "bottom right",
        transition: "opacity 0.25s ease, transform 0.25s ease",
      }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "13px 16px", background: "#0c831f", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>🌱</div>
            <div>
              <p style={{ margin: 0, color: "white", fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>AgriChat</p>
              <p style={{ margin: 0, color: "rgba(255,255,255,0.75)", fontSize: 11 }}>
                {loading ? "Typing..." : "AI Assistant · Always Online"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {language && (
              <button
                onClick={() => { setLanguage(null); setMessages([]); }}
                style={{
                  background: "rgba(255,255,255,0.2)", border: "none", color: "white",
                  borderRadius: 999, padding: "4px 10px", fontSize: 11,
                  fontWeight: 600, cursor: "pointer",
                }}
              >
                Change
              </button>
            )}
            <button onClick={reset} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "white", padding: 6, borderRadius: "50%", display: "flex",
            }}>
              <X size={19} />
            </button>
          </div>
        </div>

        {/* ── Language selection ── */}
        {!language ? (
          <div style={{
            flex: 1, overflowY: "auto",
            padding: "20px 16px", background: "#f7f7f7",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 16,
          }}>
            <div style={{ fontSize: 44, lineHeight: 1 }}>🌾</div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: "#111" }}>Choose Language</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666" }}>अपनी भाषा चुनें</p>
            </div>

            {/* 2-column grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: 10, width: "100%", maxWidth: 320,
            }}>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => selectLanguage(lang.value)}
                  style={{
                    padding: "12px 8px",
                    borderRadius: 12,
                    border: "1.5px solid #0c831f",
                    background: "white",
                    color: "#0c831f",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    boxShadow: "0 1px 4px rgba(12,131,31,0.1)",
                    transition: "background 0.15s, color 0.15s",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#0c831f";
                    (e.currentTarget as HTMLButtonElement).style.color = "white";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "white";
                    (e.currentTarget as HTMLButtonElement).style.color = "#0c831f";
                  }}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ── Messages ── */}
            <div style={{
              flex: 1, overflowY: "auto",
              padding: "14px 12px 6px",
              display: "flex", flexDirection: "column", gap: 10,
              background: "#f0f0f0",
            }}>
              {messages.map((msg) => (
                <div key={msg.id} style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}>
                  {msg.role === "bot" && (
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "#0c831f", color: "white",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, flexShrink: 0, marginRight: 6, alignSelf: "flex-end",
                    }}>🌱</div>
                  )}
                  <div style={{
                    maxWidth: "75%", padding: "9px 13px",
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: msg.role === "user" ? "#0c831f" : "#ffffff",
                    color: msg.role === "user" ? "white" : "#1a1a1a",
                    fontSize: 13.5, lineHeight: 1.55,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                    fontFamily: "inherit",
                  }}>
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", background: "#0c831f",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, flexShrink: 0,
                  }}>🌱</div>
                  <div style={{
                    padding: "10px 14px", borderRadius: "16px 16px 16px 4px",
                    background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                    display: "flex", gap: 4, alignItems: "center",
                  }}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{
                        width: 7, height: 7, borderRadius: "50%", background: "#0c831f",
                        display: "inline-block",
                        animation: `agri-bounce 1.1s ease-in-out ${i * 0.18}s infinite`,
                      }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* ── Input box ── */}
            <div style={{
              padding: "10px 12px", borderTop: "1px solid #e8e8e8",
              background: "white", display: "flex", gap: 8,
              alignItems: "flex-end", flexShrink: 0,
            }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={PLACEHOLDER[language]}
                disabled={loading}
                rows={1}
                style={{
                  flex: 1, border: "1.5px solid #e0e0e0", borderRadius: 20,
                  padding: "10px 16px", fontSize: 13.5, outline: "none",
                  background: "#f7f7f7", fontFamily: "inherit",
                  resize: "none", overflow: "hidden",
                  lineHeight: "1.45", height: 42,
                }}
              />
              {/* Mic button */}
              <button
                onClick={startVoiceInput}
                disabled={loading}
                title={isListening ? "Stop listening" : "Speak your question"}
                style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: isListening ? "#0c831f" : "#f0f0f0",
                  border: "none",
                  color: isListening ? "white" : "#888",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: loading ? "not-allowed" : "pointer",
                  flexShrink: 0, transition: "background 0.2s, color 0.2s",
                  animation: isListening ? "agri-pulse 1s ease-in-out infinite" : "none",
                }}
              >
                <Mic size={16} />
              </button>
              {/* Send button */}
              <button
                onClick={send}
                disabled={!input.trim() || loading}
                style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: input.trim() && !loading ? "#0c831f" : "#d4d4d4",
                  border: "none", color: "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: input.trim() && !loading ? "pointer" : "not-allowed",
                  flexShrink: 0, transition: "background 0.2s",
                }}
              >
                <Send size={16} />
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes agri-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.6; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes agri-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(12,131,31,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(12,131,31,0); }
        }
        @media (max-width: 500px) {
          .agri-chat-panel {
            width: calc(100vw - 24px) !important;
            right: 12px !important;
            height: 70vh !important;
            bottom: 80px !important;
          }
        }
      `}</style>
    </>
  );
}
