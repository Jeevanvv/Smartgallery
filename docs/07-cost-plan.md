# Cost Plan

Excluding domain (~₹800–1,200/year). Everything below targets **₹0/month** at launch.

## Monthly running costs (small-medium photographer)

| Service | Cost |
|---------|------|
| Vercel (frontend) | ₹0 / month |
| Railway / Render (backend) | ₹0 / month (free tier) |
| Supabase (PostgreSQL + pgvector) | ₹0 / month (500MB) |
| Upstash Redis | ₹0 / month (10k req/day) |
| Google Drive API | ₹0 / month |
| InsightFace / AI models | ₹0 / month (open source) |
| Google OAuth | ₹0 / month |
| Cloudflare (CDN + DDoS) | ₹0 / month |
| **Total** | **₹0 / month** |

## One-time / annual

| Item | Cost |
|------|------|
| Domain (.in) | ~₹800–1,200 / year |
| SSL | ₹0 (Cloudflare / Let's Encrypt) |
| Google Cloud project | ₹0 |

## When you outgrow free tiers

| Trigger | Estimated cost |
|---------|----------------|
| Supabase Pro (>500MB DB) | ~₹2,000/month |
| Railway paid (heavy processing) | ~₹400–800/month |
| AWS Lambda (scalable processing) | ~₹200–500/month |
| Scale: 100 events, 50k photos | ~₹2,500–4,000/month |

## Launch estimate

For 5–20 events/month, up to 10,000 photos: **₹0/month** operating cost. Only domain is mandatory (~₹100/month amortized).

## Processing tip

Run face indexing off-peak (2am–6am IST) via cron to avoid free-tier rate limits.
