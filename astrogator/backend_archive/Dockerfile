# Use official lightweight Python image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (none needed for pure python logic, but maybe for numpy/spiceypy headers?)
# spiceypy usually has wheels.
# RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run commands
# Using uvicorn directly. In prod, gunicorn w/ uvicorn workers is better, but this is fine for home server.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
