import asyncio
import edge_tts
from pathlib import Path

TEXT = "明天下午三点提醒我带钥匙"
VOICE = "zh-CN-XiaoxiaoNeural"
OUT = str(Path(__file__).resolve().parent / "speech.mp3")


async def main() -> None:
    communicate = edge_tts.Communicate(TEXT, VOICE)
    await communicate.save(OUT)
    print("saved:", OUT)


asyncio.run(main())
