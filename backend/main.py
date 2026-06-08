from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import easyocr
import cv2
import numpy as np
import os
import base64
import httpx

app = FastAPI(title="Video OCR Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

frontend_dir = Path(__file__).resolve().parent.parent / "frontend"


if not frontend_dir.exists():
    raise RuntimeError(f"Frontend folder not found: {frontend_dir}")

app.mount("/static", StaticFiles(directory=str(frontend_dir)), name="static")

class TranslateRequest(BaseModel):
    text: str
    source: str = "auto"
    target: str = "ru"

@app.post("/translate")
async def translate_text(request: TranslateRequest):
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Текст для перевода не может быть пустым")

    api_url = os.getenv("TRANSLATE_API_URL", "https://translate.api.cloud.yandex.net/translate/v2/translate")
    api_key = os.getenv("YANDEX_API_KEY")
    folder_id = os.getenv("YANDEX_FOLDER_ID")
    
    if not api_key or not folder_id:
        raise HTTPException(
            status_code=500,
            detail="Для Yandex Translate задайте переменные YANDEX_API_KEY и YANDEX_FOLDER_ID"
        )

    yandex_body = {
        "folderId": folder_id,
        "texts": [text],
        "targetLanguageCode": request.target,
    }
    if request.source and request.source != "auto":
        yandex_body["sourceLanguageCode"] = request.source

    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            response = await client.post(
                api_url,
                json=yandex_body,
                headers={
                    "Authorization": f"Api-Key {api_key}",
                    "Content-Type": "application/json"
                }
            )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        error_detail = str(exc)
        try:
            if hasattr(exc, 'response') and exc.response:
                error_detail = exc.response.text
        except:
            pass
        print(f"Yandex Translate error: {error_detail}")
        raise HTTPException(status_code=502, detail=f"Ошибка перевода: {error_detail}") from exc

    result = response.json()
    translations = result.get("translations")
    if not translations or not isinstance(translations, list):
        raise HTTPException(status_code=502, detail=f"Неверный ответ Yandex Translate: {result}")
    if not translations[0].get("text"):
        raise HTTPException(status_code=502, detail=f"Пустой перевод от Yandex: {result}")
    translated = translations[0]["text"]
    detected_source = result.get("sourceLanguageCode", request.source)

    return {
        "translated_text": translated,
        "source": detected_source,
    }

@app.get("/", response_class=FileResponse)
async def root():
    index_file = frontend_dir / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=500, detail="Frontend index.html not found")
    return FileResponse(str(index_file))

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    favicon_path = frontend_dir / "favicon.ico"
    if favicon_path.exists():
        return FileResponse(str(favicon_path))
    raise HTTPException(status_code=404)

ocr = easyocr.Reader(['de'])

@app.post("/ocr")
async def recognize(file: UploadFile = File(...)):

    contents = await file.read()

    nparr = np.frombuffer(contents, np.uint8)

    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(
            status_code=422,
            detail="Не удалось декодировать изображение"
        )

    results = ocr.readtext(img)
    print(f'OCR request received: image size={img.shape if img is not None else None}, results_count={len(results)}')

    if not results:
        print('OCR: text not recognized')
        return {"text": "текст не распознан", "image": "", "words": []}

    processed = []

    for idx, (bbox, text, conf) in enumerate(results, start=1):

        xs = [p[0] for p in bbox]
        ys = [p[1] for p in bbox]

        x1 = int(min(xs))
        y1 = int(min(ys))
        x2 = int(max(xs))
        y2 = int(max(ys))

        cv2.rectangle(
            img,
            (x1, y1),
            (x2, y2),
            (0, 255, 0),
            2
        )

        cv2.putText(
            img,
            str(idx),
            (x1, y1 - 10),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (0, 0, 255),
            2
        )

        print(f'OCR bbox {idx}: x1={x1}, y1={y1}, x2={x2}, y2={y2}, text="{text}", conf={conf}')

        processed.append({
            "id": idx,
            "text": text,
            "conf": float(conf),
            "x1": x1,
            "y1": y1,
            "x2": x2,
            "y2": y2,
            "x": x1,
            "y": y1,
            "center_y": (y1 + y2) / 2
        })

    processed.sort(
        key=lambda item: (
            round(item["center_y"] / 20),
            item["x"]
        )
    )

    for idx, item in enumerate(processed, start=1):

        item["id"] = idx

        print(
            f"[{idx}] "
            f"{item['text']} | "
            f"({item['x1']}, {item['y1']}) "
            f"-> "
            f"({item['x2']}, {item['y2']}) | "
            f"conf={item['conf']:.2f}"
        )

    final_text = " ".join(
        [f"[{item['id']}] {item['text']}" for item in processed]
    )

    print(f'OCR final_text: {final_text}')
    print(f'OCR words returned: {len(processed)}')

    return {
        "text": final_text,
        "words": processed,

        # useful for frontend scaling
        "image_width": int(img.shape[1]),
        "image_height": int(img.shape[0])
    }
