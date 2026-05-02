# Supplier Acquisition Engine

Private internal batch supplier scraping and outreach drafting app.

## What this build does

- Takes **one search/results URL** and runs the full batch in one pass
- Or takes **pasted search page HTML** and runs the full batch in one pass
- Or takes a **newline list of supplier URLs** and runs the full batch in one pass
- Extracts supplier facts with OpenAI using your saved business prompt
- Writes **custom outreach per supplier**
- Gives you a queue of leads with statuses and drafts ready to copy/send
- Exports the batch as CSV

## What this build does not pretend to do

- It does not auto-log into Alibaba
- It does not claim to send marketplace messages for you
- It does not include fake dashboards or dead routes

## Run locally

```bash
cd ~/supplier-acquisition-engine
npm install
npm run smoke
npm test
OPENAI_API_KEY="YOUR_REAL_KEY" npm start
```

Open:

```text
http://localhost:3000
```

## One-line run after install

```bash
cd ~/supplier-acquisition-engine && OPENAI_API_KEY="YOUR_REAL_KEY" npm start
```

## Save your key for future terminal sessions

```bash
echo 'export OPENAI_API_KEY="YOUR_REAL_KEY"' >> ~/.bashrc
source ~/.bashrc
```

Then you can start it with:

```bash
cd ~/supplier-acquisition-engine && npm start
```

## Main routes

- `POST /api/pipeline/search`
- `POST /api/pipeline/search-html`
- `POST /api/pipeline/urls`
- `GET /api/leads`
- `GET /api/leads/next-draft-ready`
- `PATCH /api/leads/:id`
- `POST /api/leads/mark-contacted`
- `GET /api/export.csv`

## Test coverage

- `npm run smoke`
- `npm test`

Smoke uses mock AI mode so you can verify the full local flow without spending tokens.
