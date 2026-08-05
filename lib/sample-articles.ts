export type SentimentLabel = "positive" | "neutral" | "negative";
export type BiasLabel = "left" | "center" | "right" | "mixed" | "unclear";

export type SampleArticle = {
  id: string;
  title: string;
  imageUrl: string;
  category: string;
  location: string;
  source: string;
  publishedAt: string;
  sentimentLabel: SentimentLabel;
  biasLabel: BiasLabel;
  leftPercentage: number;
  centerPercentage: number;
  rightPercentage: number;
  confidence: number;
  summary: string;
  bodyParagraphs: string[];
  framingNotes: string;
  loadedTerms: string[];
  disclaimer: string;
};

export const AI_DISCLAIMER =
  "This analysis is AI-generated and may contain inaccuracies. It should not be taken as objective fact.";

export const sampleArticles: SampleArticle[] = [
  {
    id: "trump-iran-peace-proposal",
    title: "Trump Sends Iran Revised Peace Proposal With Tougher Terms: Report",
    imageUrl: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&h=500&fit=crop",
    category: "Politics",
    location: "United States",
    source: "The National Herald",
    publishedAt: "2026-06-01T09:15:00.000Z",
    sentimentLabel: "neutral",
    biasLabel: "right",
    leftPercentage: 20,
    centerPercentage: 31,
    rightPercentage: 49,
    confidence: 0.78,
    summary:
      "The Trump administration has sent Iran a revised nuclear deal proposal with tougher terms, including a halt to uranium enrichment and unrestricted inspector access. Iran has not officially responded, while European allies urge continued negotiations and Israel praises the tougher U.S. stance.",
    bodyParagraphs: [
      "The Trump administration has sent Iran a revised nuclear deal proposal that includes tougher terms on uranium enrichment and stronger verification measures, according to a report published Saturday.",
      "The new proposal, delivered through intermediaries in Oman, requires Iran to halt all uranium enrichment on its soil and ship its stockpile of enriched uranium out of the country. It also demands unrestricted access for international inspectors to all Iranian nuclear facilities, including military sites.",
      "\"This is a take-it-or-leave-it proposal,\" a senior administration official said. \"The President wants a deal, but he will not accept a weak agreement that puts America or our allies at risk.\"",
      "Iran has not yet officially responded to the proposal. However, Iranian officials have said that any deal must respect Iran's right to peaceful nuclear energy and include the lifting of U.S. sanctions.",
      "The revised proposal comes after several rounds of indirect talks between U.S. and Iranian officials failed to produce a breakthrough. European allies have urged both sides to continue negotiations, while Israel has praised the administration's tougher stance.",
      "The fate of the proposal now rests with Iran, as global attention remains focused on whether a new nuclear agreement can be reached, or if tensions will escalate further.",
    ],
    framingNotes:
      "Coverage emphasizes the administration's firm negotiating posture and frames the proposal as a decisive stand, language more common in right-leaning outlets. Center and left-leaning coverage of the same report placed more weight on the risk of collapsed diplomacy.",
    loadedTerms: ["take-it-or-leave-it", "tougher terms", "unrestricted access"],
    disclaimer: AI_DISCLAIMER,
  },
  {
    id: "grapes-superfood-review",
    title: "Researchers Make Case for Grapes as a 'Superfood' After Review of Health Evidence",
    imageUrl: "https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800&h=500&fit=crop",
    category: "Health",
    location: "United States",
    source: "Wellness Daily",
    publishedAt: "2026-06-01T08:40:00.000Z",
    sentimentLabel: "positive",
    biasLabel: "center",
    leftPercentage: 18,
    centerPercentage: 42,
    rightPercentage: 40,
    confidence: 0.64,
    summary:
      "A review of existing health studies argues grapes deserve 'superfood' status for their antioxidant and cardiovascular benefits. Researchers caution more controlled trials are needed before firm dietary recommendations can be made.",
    bodyParagraphs: [
      "A new review of published health studies makes the case that grapes deserve recognition as a 'superfood,' citing their concentration of antioxidants and links to improved cardiovascular health.",
      "The review, compiled by a team of nutrition researchers, pooled data from more than two dozen studies examining grape consumption and markers of heart health, inflammation, and cognitive function.",
      "\"Grapes contain a unique combination of polyphenols that we don't see at the same levels in many other fruits,\" one of the review's authors said in a statement accompanying the findings.",
      "Not all experts are convinced the evidence is strong enough to justify the 'superfood' label. Several nutritionists noted that most of the underlying studies were small or observational rather than large randomized trials.",
      "The researchers say the findings support including grapes as part of a balanced diet, but stopped short of recommending specific daily intake targets, saying more controlled research is needed.",
    ],
    framingNotes:
      "Coverage is broadly celebratory of the findings, with modest hedging from outlets that included independent nutritionist caveats about the strength of the underlying evidence.",
    loadedTerms: ["superfood", "unique combination"],
    disclaimer: AI_DISCLAIMER,
  },
  {
    id: "cern-physics-hint",
    title: "CERN Finds High-Significance Hint of Physics Beyond Standard Model",
    imageUrl: "https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?w=800&h=500&fit=crop",
    category: "Science",
    location: "Switzerland",
    source: "Global Science Wire",
    publishedAt: "2026-06-01T07:05:00.000Z",
    sentimentLabel: "positive",
    biasLabel: "center",
    leftPercentage: 16,
    centerPercentage: 62,
    rightPercentage: 22,
    confidence: 0.81,
    summary:
      "Physicists at CERN report a high-significance anomaly in particle collision data that could hint at physics beyond the Standard Model. Researchers stress that further data collection is needed before the result can be confirmed as a genuine discovery.",
    bodyParagraphs: [
      "Physicists at CERN have reported a statistically significant anomaly in particle collision data that, if confirmed, could point to physics beyond the Standard Model.",
      "The result emerged from an analysis of collisions recorded at the Large Hadron Collider, where researchers observed decay patterns that deviate from theoretical predictions at a level rarely seen in particle physics.",
      "\"We're seeing something that doesn't fit cleanly into our existing framework,\" one of the lead researchers said. \"That's exactly the kind of anomaly we build these experiments to look for.\"",
      "The physics community has learned to treat such anomalies with caution. Several promising signals in past years have faded as more data was collected, a reminder that statistical significance alone does not guarantee a genuine discovery.",
      "CERN researchers say additional collision data expected over the next run of the collider should help determine whether the anomaly persists or fades, as similar signals have in the past.",
    ],
    framingNotes:
      "Coverage is largely uniform and technical across the political spectrum, with most outlets emphasizing the preliminary nature of the finding rather than framing it politically.",
    loadedTerms: ["high-significance", "beyond the Standard Model"],
    disclaimer: AI_DISCLAIMER,
  },
  {
    id: "brooklyn-rivera-nicaragua",
    title: "Indigenous Leader Brooklyn Rivera Dies in Nicaragua After Nearly 3 Years of Detention",
    imageUrl: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800&h=500&fit=crop",
    category: "World",
    location: "Nicaragua",
    source: "Continental Report",
    publishedAt: "2026-05-31T22:10:00.000Z",
    sentimentLabel: "negative",
    biasLabel: "left",
    leftPercentage: 54,
    centerPercentage: 28,
    rightPercentage: 18,
    confidence: 0.7,
    summary:
      "Indigenous rights leader Brooklyn Rivera has died after nearly three years of detention in Nicaragua. Human rights groups say his death draws renewed attention to the treatment of political prisoners under the Ortega government.",
    bodyParagraphs: [
      "Indigenous rights leader Brooklyn Rivera has died in Nicaragua after being held in detention for nearly three years, according to family members and human rights organizations.",
      "Rivera, a longtime advocate for the Miskito indigenous community on Nicaragua's Caribbean coast, was detained in 2023 amid a broader crackdown on political opponents and civil society figures.",
      "Human rights groups say Rivera's health had deteriorated significantly during his detention, and that repeated requests for adequate medical care were denied by prison authorities.",
      "The Nicaraguan government has not issued a public statement on Rivera's death. Officials have previously defended the detentions as necessary for national security.",
      "International rights organizations are calling for an independent investigation into the circumstances of Rivera's death and renewed pressure on the Ortega government over its treatment of political prisoners.",
    ],
    framingNotes:
      "Coverage leans toward framing the death as a consequence of government repression, language more common among left-leaning outlets critical of the Ortega government's human rights record.",
    loadedTerms: ["crackdown", "political prisoners", "repression"],
    disclaimer: AI_DISCLAIMER,
  },
  {
    id: "un-security-council-lebanon",
    title: "UN Security Council to Hold Emergency Meeting as Israel Pushes Deeper into Lebanon",
    imageUrl: "https://images.unsplash.com/photo-1587571522815-7f9d9e6a7fd7?w=800&h=500&fit=crop",
    category: "World",
    location: "Middle East",
    source: "Frontline Dispatch",
    publishedAt: "2026-05-31T20:30:00.000Z",
    sentimentLabel: "negative",
    biasLabel: "mixed",
    leftPercentage: 22,
    centerPercentage: 35,
    rightPercentage: 43,
    confidence: 0.58,
    summary:
      "The UN Security Council will hold an emergency meeting after Israeli forces advanced further into southern Lebanon. Member states are divided over how to respond, with calls for an immediate ceasefire meeting resistance from some council members.",
    bodyParagraphs: [
      "The UN Security Council has scheduled an emergency meeting after Israeli forces pushed further into southern Lebanon, escalating a conflict that has drawn growing international concern.",
      "Diplomats said the session was requested by several council members alarmed by reports of expanding ground operations and rising civilian casualties in border communities.",
      "Israel has said the operation is necessary to push back armed groups operating near its northern border and has rejected calls for an immediate unconditional ceasefire.",
      "Lebanese officials have called for urgent international intervention, describing the situation in affected border towns as a humanitarian emergency.",
      "Council members remain divided over the wording of a potential resolution, with some pushing for an immediate ceasefire demand and others favoring language that also addresses the armed groups' presence near the border.",
    ],
    framingNotes:
      "Coverage of this story varies significantly by outlet in how it characterizes the offensive and casualty reporting, reflecting broader divides in how the conflict is framed across the political spectrum.",
    loadedTerms: ["ground operations", "humanitarian emergency", "pushed deeper"],
    disclaimer: AI_DISCLAIMER,
  },
  {
    id: "oil-prices-opec",
    title: "Oil Prices Dip as OPEC+ Considers Output Increase Amid Weak Demand",
    imageUrl: "https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=800&h=500&fit=crop",
    category: "Business",
    location: "Global",
    source: "Market Ledger",
    publishedAt: "2026-05-31T18:00:00.000Z",
    sentimentLabel: "neutral",
    biasLabel: "center",
    leftPercentage: 25,
    centerPercentage: 50,
    rightPercentage: 25,
    confidence: 0.72,
    summary:
      "Oil prices fell after reports that OPEC+ is weighing a further increase in production amid signs of weakening global demand. Analysts say the group is balancing market share concerns against the risk of oversupply.",
    bodyParagraphs: [
      "Oil prices dipped Wednesday after reports that OPEC+ producers are considering another increase in output, adding to concerns about weakening global demand.",
      "Benchmark crude futures fell more than two percent in early trading as traders weighed the prospect of additional supply entering a market already showing signs of softness.",
      "OPEC+ officials have not confirmed a final decision, but delegates said discussions have focused on balancing member states' desire for greater market share against the risk of driving prices down further.",
      "Analysts said weaker manufacturing data from several major economies has weighed on demand expectations in recent weeks, adding pressure on the group to reconsider its output strategy.",
      "A final decision from OPEC+ is expected at its next scheduled meeting, with markets watching closely for signals on the group's production targets for the coming quarter.",
    ],
    framingNotes:
      "Coverage is largely factual market reporting with minimal political framing; language is consistent across outlets regardless of political lean.",
    loadedTerms: ["market share", "oversupply"],
    disclaimer: AI_DISCLAIMER,
  },
  {
    id: "spacex-starship-test",
    title: "SpaceX Launches Starship Test Flight in Milestone for Mars Program",
    imageUrl: "https://images.unsplash.com/photo-1517976487492-5750f3195933?w=800&h=500&fit=crop",
    category: "Technology",
    location: "United States",
    source: "Orbit News",
    publishedAt: "2026-05-31T15:45:00.000Z",
    sentimentLabel: "positive",
    biasLabel: "right",
    leftPercentage: 12,
    centerPercentage: 45,
    rightPercentage: 43,
    confidence: 0.69,
    summary:
      "SpaceX successfully launched another Starship test flight, reaching several key milestones toward the company's long-term Mars program. The company says data from the flight will inform upcoming crewed mission planning.",
    bodyParagraphs: [
      "SpaceX launched another test flight of its Starship rocket on Sunday, reaching several key milestones the company says bring it closer to supporting crewed missions to Mars.",
      "The launch marks the latest in a series of test flights aimed at proving the reusability and reliability of the world's largest and most powerful rocket system.",
      "\"Every flight gets us closer to a fully reusable system that can make Mars missions economically viable,\" a SpaceX spokesperson said following the launch.",
      "The company said telemetry from the flight will be used to refine the vehicle's heat shield and landing systems ahead of future missions.",
      "SpaceX has not set a firm date for its first crewed Mars mission but has said Starship's ongoing test program is central to that long-term goal.",
    ],
    framingNotes:
      "Coverage frames the launch as an unambiguous milestone with celebratory language, a framing more consistently applied in outlets favorable toward commercial spaceflight.",
    loadedTerms: ["milestone", "economically viable"],
    disclaimer: AI_DISCLAIMER,
  },
  {
    id: "apple-ai-features",
    title: "Apple Unveils AI-Powered Features Across iPhone, iPad and Mac",
    imageUrl: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&h=500&fit=crop",
    category: "Business",
    location: "United States",
    source: "Tech Ledger",
    publishedAt: "2026-05-31T14:20:00.000Z",
    sentimentLabel: "positive",
    biasLabel: "center",
    leftPercentage: 15,
    centerPercentage: 40,
    rightPercentage: 45,
    confidence: 0.6,
    summary:
      "Apple announced a new set of AI-powered features rolling out across its iPhone, iPad, and Mac product lines. The company emphasized on-device processing for privacy, while some analysts questioned how the features compare to competitors.",
    bodyParagraphs: [
      "Apple unveiled a new suite of AI-powered features that will roll out across iPhone, iPad, and Mac devices later this year, the company announced Sunday.",
      "The new capabilities include improved writing tools, smarter photo search, and enhanced Siri functionality, with Apple emphasizing that much of the processing happens on-device rather than in the cloud.",
      "\"We built these features around a simple principle: powerful AI shouldn't come at the cost of your privacy,\" an Apple executive said during the announcement.",
      "Industry analysts offered mixed reactions, with some praising the privacy-first approach while others questioned whether the features match the capabilities already available from competitors.",
      "The features will begin rolling out in a software update later this year, with Apple saying broader international availability will follow in subsequent updates.",
    ],
    framingNotes:
      "Coverage is generally positive across outlets, with variation mainly in how much weight is given to competitor comparisons versus Apple's privacy framing.",
    loadedTerms: ["privacy-first", "powerful AI"],
    disclaimer: AI_DISCLAIMER,
  },
  {
    id: "2025-hottest-years-eu",
    title: "2025 on Track to Be Among Top 3 Hottest Years, EU Climate Service Says",
    imageUrl: "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800&h=500&fit=crop",
    category: "Climate",
    location: "Global",
    source: "Earth Signal",
    publishedAt: "2026-05-31T11:00:00.000Z",
    sentimentLabel: "negative",
    biasLabel: "unclear",
    leftPercentage: 33,
    centerPercentage: 34,
    rightPercentage: 33,
    confidence: 0.42,
    summary:
      "The EU's climate monitoring service says 2025 is on track to rank among the three hottest years on record globally. Scientists point to a combination of long-term warming trends and short-term climate patterns as contributing factors.",
    bodyParagraphs: [
      "The European Union's climate monitoring service says 2025 is on track to rank among the three hottest years ever recorded globally, continuing a trend of record-breaking temperatures in recent years.",
      "Data compiled through the first several months of the year shows average global temperatures running well above the twentieth-century baseline, according to the service's latest report.",
      "Scientists attribute the elevated temperatures to a combination of long-term greenhouse gas-driven warming and shorter-term natural climate patterns affecting ocean temperatures.",
      "The findings add to a growing body of data showing the past decade as the warmest on record, with researchers warning that extreme heat events are becoming more frequent and intense.",
      "Climate researchers say the final ranking for the year will depend on temperature patterns over the remaining months, but that 2025 is unlikely to fall outside the top three.",
    ],
    framingNotes:
      "Sample confidence is low and percentages are nearly even, reflecting genuinely mixed and inconclusive framing signals across the sources analyzed for this article.",
    loadedTerms: ["record-breaking", "extreme heat"],
    disclaimer: AI_DISCLAIMER,
  },
  {
    id: "fed-holds-rates",
    title: "Fed Holds Rates Steady, Signals Caution on Inflation and Growth Outlook",
    imageUrl: "https://images.unsplash.com/photo-1554260570-83b1a1ff3b3f?w=800&h=500&fit=crop",
    category: "Economy",
    location: "United States",
    source: "Capital Wire",
    publishedAt: "2026-05-31T09:30:00.000Z",
    sentimentLabel: "neutral",
    biasLabel: "right",
    leftPercentage: 30,
    centerPercentage: 45,
    rightPercentage: 25,
    confidence: 0.66,
    summary:
      "The Federal Reserve held interest rates steady, citing continued uncertainty around inflation and economic growth. Officials signaled a cautious, data-dependent approach to future policy decisions.",
    bodyParagraphs: [
      "The Federal Reserve held interest rates steady at its latest policy meeting, citing continued uncertainty around inflation and the broader economic growth outlook.",
      "In a statement accompanying the decision, the central bank said it would continue to monitor incoming economic data closely before making further adjustments to policy.",
      "\"We remain committed to bringing inflation back to target without unnecessarily weakening the labor market,\" the Fed chair said at a press conference following the announcement.",
      "Economists were divided on the implications of the decision, with some viewing it as a sign of confidence in the economy's resilience and others warning it reflects growing concern about slowing growth.",
      "Markets showed a muted reaction to the announcement, with investors largely having anticipated that rates would remain unchanged at this meeting.",
    ],
    framingNotes:
      "Coverage framing the decision as fiscally cautious and disciplined skews toward outlets with a more right-leaning economic framing; other outlets emphasized growth risk instead.",
    loadedTerms: ["data-dependent", "fiscally cautious"],
    disclaimer: AI_DISCLAIMER,
  },
  {
    id: "real-madrid-champions-league",
    title: "Real Madrid Win Champions League After Comeback Victory in Final",
    imageUrl: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&h=500&fit=crop",
    category: "Soccer",
    location: "Europe",
    source: "Pitchside Report",
    publishedAt: "2026-05-30T23:50:00.000Z",
    sentimentLabel: "positive",
    biasLabel: "right",
    leftPercentage: 10,
    centerPercentage: 20,
    rightPercentage: 70,
    confidence: 0.5,
    summary:
      "Real Madrid claimed the Champions League title with a dramatic comeback victory in the final, overturning a two-goal deficit in the second half. The result extends the club's record for the most Champions League titles won.",
    bodyParagraphs: [
      "Real Madrid claimed the Champions League title after a dramatic comeback victory in Saturday's final, overturning a two-goal deficit in the second half.",
      "The club trailed by two goals at halftime before a second-half surge, including two goals in the final fifteen minutes, secured the victory in front of a capacity crowd.",
      "\"This team never stops believing, no matter the scoreline,\" the winning manager said after the match. \"That's what makes nights like this possible.\"",
      "The victory extends Real Madrid's record as the most successful club in the competition's history, adding another title to an already unmatched collection.",
      "Fans celebrated late into the night across the club's home city, with tens of thousands gathering to mark the latest chapter in the club's European history.",
    ],
    framingNotes:
      "Sports coverage of this result is celebratory across essentially all outlets covering the club; the bias percentages here reflect the outlet mix analyzed rather than contested political framing.",
    loadedTerms: ["never stops believing", "unmatched collection"],
    disclaimer: AI_DISCLAIMER,
  },
  {
    id: "wildfires-western-canada",
    title: "Wildfires Force Thousands to Evacuate Across Western Canada",
    imageUrl: "https://images.unsplash.com/photo-1602491453631-e2a5ad90a131?w=800&h=500&fit=crop",
    category: "Environment",
    location: "Canada",
    source: "Northern Bulletin",
    publishedAt: "2026-05-30T19:15:00.000Z",
    sentimentLabel: "negative",
    biasLabel: "center",
    leftPercentage: 27,
    centerPercentage: 33,
    rightPercentage: 40,
    confidence: 0.61,
    summary:
      "Fast-moving wildfires have forced thousands of residents to evacuate across Western Canada as dry conditions and high winds fuel rapid fire growth. Emergency crews are working to contain the blazes as officials warn conditions could worsen.",
    bodyParagraphs: [
      "Fast-moving wildfires have forced thousands of residents to evacuate communities across Western Canada, as dry conditions and high winds continue to fuel rapid fire growth.",
      "Provincial emergency officials issued mandatory evacuation orders for several communities after fire activity increased overnight, cutting off some access roads.",
      "\"Conditions on the ground are changing quickly, and we need residents to leave as soon as an order is issued,\" a provincial fire official said at a briefing Sunday.",
      "Firefighting crews, supported by air tankers, are working to contain the largest of the blazes, though officials cautioned that forecasted winds could complicate those efforts in the coming days.",
      "Emergency shelters have been set up in nearby cities to house displaced residents, with officials saying it remains too early to estimate when evacuees might be able to return home.",
    ],
    framingNotes:
      "Coverage is largely consistent across outlets in its urgency and focus on evacuation logistics, with only modest variation in how much attention is given to climate context.",
    loadedTerms: ["fast-moving", "mandatory evacuation"],
    disclaimer: AI_DISCLAIMER,
  },
];
