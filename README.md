# Datrixs — AI Data Analyst

Datrixs is an AI-powered data analysis agent that lets you upload tabular data
from multiple file formats and query it using natural language.

## Features

- Upload CSV, XLSX, PDF tables, and scanned images
- Natural language queries about your data
- Streaming AI responses
- Summary statistics and data insights
- Multi-file session management
- Conversation history

## Tech Stack

- **Frontend:** Next.js 16, Tailwind CSS, shadcn/ui
- **Agent:** Mastra + OpenRouter
- **Database:** SQLite + Prisma
- **Data Processing:** FastAPI + pandas (Python)

## Prerequisites

- Node.js v18+
- Python 3.9+
- Git
- Tesseract OCR (for scanned image support)

### Install Tesseract (Mac)
```bash
brew install tesseract
```

### Install Tesseract (Ubuntu/Debian)
```bash
sudo apt-get install tesseract-ocr
```

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

Open `.env.local` and add your OpenRouter API key:
```bash
OPENROUTER_API_KEY=your_openrouter_api_key_here
MODEL_NAME=nvidia/nemotron-3-nano-30b-a3b:free
NEXT_PUBLIC_APP_URL=http://localhost:3000
FASTAPI_URL=http://localhost:8000
DATABASE_URL="file:./prisma/dev.db"
```

Get your free API key at: https://openrouter.ai

### 4. Set up the database
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Set up the Python microservice
```bash
cd python-service
python3 -m venv venv
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
cd ..
```

## Running the App

You need two terminals running simultaneously:

### Terminal 1 — Next.js frontend
```bash
npm run dev
```

### Terminal 2 — FastAPI data processing service
```bash
cd python-service
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

Open http://localhost:3000 in your browser.

## Usage

1. Click **New Session** to create a session
2. Click the **paperclip icon** to upload a data file
3. Wait for the file status to show **ready**
4. Type a question and press **Enter**

## Evaluation

The evaluation dataset is in the `evaluation/` folder:
- `sales_data.csv` — 50 rows of sales records
- `student_data.pdf` — Student profile and course data

### 5 Evaluation Questions

| # | Question | Expected Answer |
|---|---|---|
| 1 | What is the total revenue across all orders? | $292,200.00 |
| 2 | Which product generated the highest total profit? | Laptop Pro — $42,400.00 |
| 3 | What is the average customer rating across all products? | 4.45 |
| 4 | Which region has the highest total revenue? | East — $87,400.00 |
| 5 | Who is the top sales rep by total revenue? | Alice Johnson — $109,300.00 |

### Running Evaluations
```bash
cd evaluation
python3 evaluate.py
```

## API Documentation

FastAPI docs available at: http://localhost:8000/docs

## Environment Variables

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `MODEL_NAME` | LLM model to use |
| `NEXT_PUBLIC_APP_URL` | Frontend URL |
| `FASTAPI_URL` | Python service URL |
| `DATABASE_URL` | SQLite database path |