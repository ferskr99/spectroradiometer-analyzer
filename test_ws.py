import asyncio
import websockets

async def test():
    try:
        async with websockets.connect('ws://localhost:8000/api/v1/sensors/ws') as ws:
            print("CONNECTED")
            
            while True:
                msg = await ws.recv()
                print("RECEIVED:", msg)
    except Exception as e:
        print("ERROR:", e)

if __name__ == "__main__":
    asyncio.run(test())
