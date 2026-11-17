FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY secops_mcp ./secops_mcp
COPY dashboard ./dashboard
RUN useradd --create-home secops && mkdir -p /app/data /app/snapshots && chown -R secops /app
USER secops
ENV SECOPS_MODE=sample SECOPS_DATA_DIR=/app/data SECOPS_SNAPSHOT_DIR=/app/snapshots
EXPOSE 8080
CMD ["uvicorn", "secops_mcp.web:app", "--host", "0.0.0.0", "--port", "8080", "--proxy-headers"]
