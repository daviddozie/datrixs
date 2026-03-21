# Datrixs - AI Data Analyst

Datrixs is an AI-powered data analysis agent that lets you upload tabular data from multiple file formats (CSV, XLSX, PDF tables, scanned images) and query it using natural language. It uses the **Mastra** agent framework, **OpenRouter** for LLM access, and a **FastAPI** Python microservice for data processing.

## Features

- Upload CSV, XLSX, PDF tables, and scanned images (OCR)
- Natural language queries powered by Mastra + OpenRouter
- Summary statistics: counts, averages, distributions, correlations
- AI-generated charts (bar, line, pie)
- Multi-file session management with conversation history
- CLI tool for terminal-based interaction (bonus)
- Automated evaluation suite with multi-source datasets (CSV + PDF)

## Tech Stack

- **Frontend:** Next.js 16, Tailwind CSS, shadcn/ui, Zustand
- **Agent:** Mastra + OpenRouter (configurable model via `MODEL_NAME`)
- **Database:** SQLite + Prisma
- **Data Processing:** FastAPI + pandas + pdfplumber + pytesseract
- **Vector Search:** LanceDB + sentence-transformers (RAG)

---

## Prerequisites

- Node.js v18+
- Python 3.9+
- Git
- Tesseract OCR (for scanned image support)

### Install Tesseract

**macOS:**
```bash
brew install tesseract
```

**Ubuntu/Debian:**
```bash
sudo apt-get install tesseract-ocr
```

---

## Setup

### 1. Clone the repository
```bash
git clone https://github.com/daviddozie/datrixs.git
cd datrixs
```

### 2. Install Node.js dependencies
```bash
npm install
```

### 3. Configure environment variables
```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values:
```bash
OPENROUTER_API_KEY=your_openrouter_api_key_here
MODEL_NAME=nvidia/nemotron-3-nano-30b-a3b:free
NEXT_PUBLIC_APP_URL=http://localhost:3000
FASTAPI_URL=http://localhost:8000
DATABASE_URL="file:./prisma/dev.db"
```

Get a free API key at: https://openrouter.ai

### 4. Set up the database
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Set up the Python microservice
```bash
cd python-service
python3 -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows
pip install -r requirements.txt
cd ..
```

> **Note:** The first time the service starts it will download the sentence-transformers embedding model (~90 MB). This is a one-time download.

---

## Running the App

You need **two terminals** running simultaneously.

### Terminal 1 - Next.js frontend
```bash
npm run dev
```

### Terminal 2 - FastAPI data processing service
```bash
cd python-service
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

Open http://localhost:3000 in your browser.

---

## Usage (Web UI)

1. Click **New Session** in the sidebar
2. Click the **paperclip icon** to upload a data file
3. Wait for the file status to show **Ready**
4. Type a question in the chat input and press **Enter**

---

## CLI

The CLI lets you interact with Datrixs entirely from the terminal.

### Install CLI dependencies (inside the Python venv)
```bash
cd python-service
source venv/bin/activate
cd ..
```

### Commands

**Interactive chat session (creates a new session automatically):**
```bash
python3 cli.py chat
```

**Chat with an existing session:**
```bash
python3 cli.py chat --session <session_id>
```

**List all sessions:**
```bash
python3 cli.py sessions
```

**Create a new session:**
```bash
python3 cli.py new-session "My Analysis"
```

**Upload a file to a session:**
```bash
python3 cli.py upload path/to/data.csv <session_id>
python3 cli.py upload path/to/report.pdf <session_id>
```

**Ask a one-shot question:**
```bash
python3 cli.py ask <session_id> "What is the total revenue?"
```

**Help:**
```bash
python3 cli.py --help
```

### CLI chat commands (while inside `chat`)
| Command | Description |
|---|---|
| `upload <path>` | Upload a file to the current session |
| `sessions` | List all sessions |
| `exit` / `quit` | End the session |

---

## Evaluation

The `evaluation/` folder contains a **multi-source dataset** (CSV + PDF) and an automated evaluation script.

### Evaluation datasets
| File | Format | Description |
|---|---|---|
| `evaluation/sales_data.csv` | CSV | 50 rows of sales records |
| `evaluation/student_data.pdf` | PDF | Student course performance tables |

### 7 Evaluation Questions

| # | Dataset | Question | Expected Answer |
|---|---|---|---|
| 1 | Sales CSV | What is the total revenue across all orders? | $292,200.00 |
| 2 | Sales CSV | Which product generated the highest total profit? | Laptop Pro |
| 3 | Sales CSV | What is the average customer rating? | 4.45 |
| 4 | Sales CSV | Which region has the highest total revenue? | East |
| 5 | Sales CSV | Who is the top sales rep by total revenue? | Alice Johnson |
| 6 | Student PDF | Which course has the highest average score? | Machine Learning |
| 7 | Student PDF | How many students failed their course? | 2 |

### Running the evaluation
```bash
# Make sure both services are running first (see above)
python3 evaluation/evaluate.py
```

Results are saved to `evaluation/results.json`.

---

## API Reference

FastAPI interactive docs: http://localhost:8000/docs

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/ingest` | POST | Ingest and process an uploaded file |
| `/stats` | POST | Compute summary statistics |
| `/analyze` | POST | Run programmatic data analysis |
| `/merge` | POST | Merge multiple datasets |
| `/dataset-info` | POST | Get dataset schema and preview |
| `/search` | POST | Semantic search over dataset (RAG) |
| `/visualize` | POST | Generate chart data |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | Your OpenRouter API key |
| `MODEL_NAME` | Yes | LLM model (e.g. `nvidia/nemotron-3-nano-30b-a3b:free`) |
| `NEXT_PUBLIC_APP_URL` | Yes | Frontend URL (default: `http://localhost:3000`) |
| `FASTAPI_URL` | Yes | Python service URL (default: `http://localhost:8000`) |
| `DATABASE_URL` | Yes | SQLite path (default: `file:./prisma/dev.db`) |
