import requests
import json
import time
import sys
import os

# ── Configuration ─────────────────────────────
NEXT_URL = "http://localhost:3000"
FASTAPI_URL = "http://localhost:8000"

# ── Evaluation datasets (multi-source: CSV + PDF) ──
EVAL_DIR = os.path.dirname(os.path.abspath(__file__))
DATASETS = [
    {"path": os.path.join(EVAL_DIR, "sales_data.csv"), "mime": "text/csv"},
    {"path": os.path.join(EVAL_DIR, "student_data.pdf"), "mime": "application/pdf"},
]

# ── Expected answers ──────────────────────────
EVALUATION_QUESTIONS = [
    # ── Sales dataset questions (from sales_data.csv) ──
    {
        "id": 1,
        "question": "What is the total revenue across all orders?",
        "expected": 292200.00,
        "expected_str": "$292,200.00",
        "type": "currency",
        "keywords": ["292,200", "292200"],
    },
    {
        "id": 2,
        "question": "Which product generated the highest total profit?",
        "expected": "Laptop Pro",
        "expected_str": "Laptop Pro — $42,400.00",
        "type": "text",
        "keywords": ["laptop pro", "42,400", "42400"],
    },
    {
        "id": 3,
        "question": "What is the average customer rating across all products?",
        "expected": 4.45,
        "expected_str": "4.45",
        "type": "number",
        "keywords": ["4.45", "4.4"],
    },
    {
        "id": 4,
        "question": "Which region has the highest total revenue?",
        "expected": "East",
        "expected_str": "East — $87,400.00",
        "type": "text",
        "keywords": ["east", "87,400", "87400"],
    },
    {
        "id": 5,
        "question": "Who is the top sales rep by total revenue?",
        "expected": "Alice Johnson",
        "expected_str": "Alice Johnson — $109,300.00",
        "type": "text",
        "keywords": ["alice johnson", "alice", "109,300", "109300"],
    },
    # ── Student dataset questions (from student_data.pdf) ──
    {
        "id": 6,
        "question": "Which course has the highest average score among students?",
        "expected": "Machine Learning",
        "expected_str": "Machine Learning — 88.75",
        "type": "text",
        "keywords": ["machine learning", "88.75", "88.7", "88"],
    },
    {
        "id": 7,
        "question": "How many students failed their course?",
        "expected": 2,
        "expected_str": "2 students",
        "type": "number",
        "keywords": ["2 student", "two student", "2 fail", "failed: 2", "failures: 2"],
    },
]


def check_services():
    """Verify both services are running"""
    print("🔍 Checking services...")

    try:
        requests.get(f"{NEXT_URL}/api/sessions", timeout=5)
        print(f"  ✅ Next.js running at {NEXT_URL}")
    except Exception:
        print(f"  ❌ Next.js not running at {NEXT_URL}")
        print("  Run: npm run dev")
        return False

    try:
        requests.get(f"{FASTAPI_URL}/health", timeout=5)
        print(f"  ✅ FastAPI running at {FASTAPI_URL}")
    except Exception:
        print(f"  ❌ FastAPI not running at {FASTAPI_URL}")
        print("  Run: cd python-service && uvicorn main:app --reload --port 8000")
        return False

    return True


def create_session(name: str) -> str:
    """Create a new evaluation session"""
    r = requests.post(
        f"{NEXT_URL}/api/sessions",
        json={"name": name},
        timeout=10
    )
    data = r.json()
    if data.get("success"):
        return data["data"]["id"]
    raise Exception(f"Failed to create session: {data}")


def upload_file(session_id: str, file_path: str, mime_type: str = "text/csv") -> bool:
    """Upload a dataset file to a session"""
    if not os.path.exists(file_path):
        print(f"  ⚠️  File not found: {file_path} — skipping")
        return False

    file_name = os.path.basename(file_path)
    with open(file_path, "rb") as f:
        r = requests.post(
            f"{NEXT_URL}/api/upload",
            files={"file": (file_name, f, mime_type)},
            data={"sessionId": session_id},
            timeout=30
        )
    data = r.json()
    return data.get("success", False)


def ask_question(session_id: str, question: str) -> str:
    """Send a question to the agent and get response"""
    try:
        r = requests.post(
            f"{NEXT_URL}/api/agent",
            json={"sessionId": session_id, "content": question},
            timeout=120,
            stream=True
        )

        # Collect streamed response
        full_response = ""
        for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
            if chunk:
                full_response += chunk

        if not full_response.strip():
            return "RATE_LIMIT_OR_ERROR: Empty response from agent"

        return full_response.strip()

    except requests.exceptions.Timeout:
        return "TIMEOUT: Agent took too long to respond"
    except Exception as e:
        return f"ERROR: {str(e)}"


def evaluate_response(response: str, question: dict) -> bool:
    """Check if response contains expected answer"""
    # Skip error responses
    if response.startswith(("RATE_LIMIT", "TIMEOUT", "ERROR")):
        return False

    response_lower = response.lower()
    return any(
        keyword.lower() in response_lower
        for keyword in question["keywords"]
    )


def run_evaluation():
    """Run the full evaluation suite"""
    print("\n" + "="*60)
    print("  DATRIXS EVALUATION SUITE")
    print("="*60)

    # Check services
    if not check_services():
        sys.exit(1)

    print(f"\n📁 Setting up evaluation session...")

    # Create session
    session_id = create_session("Evaluation Session")
    print(f"  ✅ Session created: {session_id}")

    # Upload all evaluation datasets (multi-source: CSV + PDF)
    uploaded_count = 0
    for dataset in DATASETS:
        file_name = os.path.basename(dataset["path"])
        success = upload_file(session_id, dataset["path"], dataset["mime"])
        if success:
            print(f"  ✅ Uploaded: {file_name}")
            uploaded_count += 1
        else:
            print(f"  ❌ Failed to upload: {file_name}")

    if uploaded_count == 0:
        print("  ❌ No datasets uploaded — aborting")
        sys.exit(1)

    # Wait for processing
    print(f"  ⏳ Waiting for data processing...")
    time.sleep(8)

    print(f"\n🧪 Running {len(EVALUATION_QUESTIONS)} evaluation questions...\n")

    results = []
    passed = 0

    for q in EVALUATION_QUESTIONS:
        print(f"Q{q['id']}: {q['question']}")
        print(f"  Expected: {q['expected_str']}")

        try:
            response = ask_question(session_id, q["question"])
            correct = evaluate_response(response, q)

            if correct:
                print(f"  ✅ PASSED")
                print(f"  Agent: {response[:150]}...")
                passed += 1
            else:
                print(f"  ❌ FAILED")
                print(f"  Agent: {response[:150]}...")

            results.append({
                "question_id": q["id"],
                "question": q["question"],
                "expected": q["expected_str"],
                "agent_response": response,
                "passed": correct
            })

        except Exception as e:
            print(f"  ❌ ERROR: {e}")
            results.append({
                "question_id": q["id"],
                "question": q["question"],
                "expected": q["expected_str"],
                "agent_response": str(e),
                "passed": False
            })

        print()
        # Wait between questions to avoid rate limits
        time.sleep(3)

    # ── Summary ───────────────────────────────
    print("="*60)
    print(f"  RESULTS: {passed}/{len(EVALUATION_QUESTIONS)} passed")
    score = (passed / len(EVALUATION_QUESTIONS)) * 100
    print(f"  SCORE: {score:.0f}%")

    if score >= 80:
        print(f"  🎉 PASSED — Above 80% threshold")
    else:
        print(f"  ⚠️  NEEDS IMPROVEMENT — Below 80% threshold")

    print("="*60)

    # Save results to JSON
    results_path = os.path.join(EVAL_DIR, "results.json")
    with open(results_path, "w") as f:
        json.dump({
            "score": score,
            "passed": passed,
            "total": len(EVALUATION_QUESTIONS),
            "results": results
        }, f, indent=2)

    print(f"\n📄 Full results saved to evaluation/results.json")
    return score


if __name__ == "__main__":
    run_evaluation()