FROM python:3.11-slim

WORKDIR /app

# System dependencies for numpy/pandas and yfinance
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Also install the direct Anthropic SDK for self-hosted mode
RUN pip install --no-cache-dir "anthropic>=0.18.0"

COPY . .

EXPOSE 8001

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
