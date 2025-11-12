import uuid
import asyncio
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from arq.connections import create_pool, ArqRedis
from contextlib import asynccontextmanager
from redis_worker import REDIS_SETTINGS 
import json

app_state = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    pool = await create_pool(REDIS_SETTINGS)
    app_state["redis_pool"] = pool
    yield
    await pool.close()

app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],  # Allows requests from your frontend
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

async def get_redis_pool() -> ArqRedis:
    return app_state["redis_pool"]

@app.get("/location/{location}")
async def get_informations(
    location: str, 
    redis_pool: ArqRedis = Depends(get_redis_pool)
):
    job_id = str(uuid.uuid4())
    await redis_pool.enqueue_job('create_data', location, _job_id=job_id, _queue_name="queue_create_data")
    return {"message": "Job erfolgreich eingereiht", "location": location, "job_id": job_id}

@app.get("/get_location/{location}")
async def get_events(
    location: str, 
    redis_pool: ArqRedis = Depends(get_redis_pool)
):
    job_id = str(uuid.uuid4())
    await redis_pool.enqueue_job('get_data', location, _job_id=job_id, _queue_name="queue_get_data")
    return {"message": "Job erfolgreich eingereiht", "location": location, "job_id": job_id}

def sse_format(data: str) -> str:
    return f"data: {data}\n\n"

async def event_stream(request: Request, job_id: str, redis_pool: ArqRedis):
    while True:
        if await request.is_disconnected():
            print(f"Client für Job {job_id} hat die Verbindung getrennt.")
            break

        result = await redis_pool.get(f"arq:job_result:{job_id}")
        if result:
            yield sse_format(result.decode())  # bytes zu str
            break 

        yield sse_format(json.dumps({"status": "in progress"}))
        await asyncio.sleep(1)  # Warte 1 Sekunde vor erneutem Polling

@app.get("/stream/{job_id}")
async def stream_results(
    request: Request,
    job_id: str,
    redis_pool: ArqRedis = Depends(get_redis_pool)
):
    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",  
    }
    return StreamingResponse(event_stream(request, job_id, redis_pool), headers=headers)

""" Das sind die angkommenden daten
            "name":name,
            "rating_average": rating_average,
            "rating_count":rating_count,
            "price_value":price_value,
            "price_currency":price_currency,
            "price_unit":price_unit,
            "duration_min_hours":duration_min_hours,
            "url":url,
            #advanced
            "highlights":highlights,
            "full_description":full_description,
            "includes":includes,
            "meeting_point":meeting_point,
            "non_suitable":non_suitable"""