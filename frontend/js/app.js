// State
let videos = [];
let currentVideoId = null;
let lastOcrText = '';
let isOcrInProgress = false;
let ocrAbortController = null;
let wasPlayingBeforeSeek = false;

console.log('JavaScript файл загружен успешно!');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, инициализация приложения...');
    loadVideos();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    console.log('Настройка обработчиков событий...');
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const tabBtns = document.querySelectorAll('.tab-btn');

    if (!uploadArea) {
        console.error('Не найден элемент uploadArea');
        return;
    }
    if (!fileInput) {
        console.error('Не найден элемент fileInput');
        return;
    }

    console.log('Элементы найдены, добавляю обработчики...');

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        console.log('Drag over');
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        console.log('Drag leave');
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        console.log('Drop event');
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    // File input
    fileInput.addEventListener('change', (e) => {
        console.log('File input change', e.target.files);
        handleFiles(e.target.files);
        e.target.value = ''; // Reset input
    });

    // Tab switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    console.log('Обработчики событий настроены');
}

// Handle File Upload
function handleFiles(files) {
    console.log('handleFiles вызвана с файлами:', files);

    if (!files || files.length === 0) {
        console.warn('Нет файлов для обработки');
        return;
    }

    Array.from(files).forEach(file => {
        console.log('Обработка файла:', file.name, file.type, file.size);

        if (!file.type.startsWith('video/')) {
            console.warn('Файл не является видео:', file.type);
            alert('Пожалуйста, выберите видеофайл');
            return;
        }

        console.log('Читаю файл с FileReader...');
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('Файл прочитан успешно, размер данных:', e.target.result.byteLength);
            const videoData = {
                id: Date.now() + Math.random(),
                name: file.name,
                size: file.size,
                type: file.type,
                data: e.target.result
            };
            videos.push(videoData);
            console.log('Видео добавлено в массив, общее количество:', videos.length);
            saveVideos();
            renderVideoList();
        };

        reader.onerror = (e) => {
            console.error('Ошибка при чтении файла:', e);
        };

        reader.readAsArrayBuffer(file);
    });
}

// Render Video List
function renderVideoList() {
    console.log('renderVideoList вызвана, количество видео:', videos.length);
    const videoListContainer = document.getElementById('videoList');

    if (!videoListContainer) {
        console.error('Не найден контейнер videoList');
        return;
    }

    if (videos.length === 0) {
        console.log('Нет видео, показываю пустое состояние');
        videoListContainer.innerHTML = `
            <div class="empty-state">
                <p>видео еще не загружены</p>
                <p style="font-size: 14px; margin-top: 10px;">начните с загрузки видеофайла выше</p>
            </div>
        `;
        return;
    }

    console.log('Рендерю список видео');
    videoListContainer.innerHTML = `
        <div class="video-list">
            <h3>загруженные видео (${videos.length})</h3>
            ${videos.map(video => `
                <div class="video-item">
                    <span> ${video.name}</span>
                    <div class="video-item-actions">
                        <button class="btn-play" onclick="playVideo(${video.id})">Воспроизвести</button>
                        <button class="btn-delete" onclick="deleteVideo(${video.id})">Удалить</button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function resizeBboxCanvas(videoElement) {
    const bboxCanvas = document.getElementById('bboxCanvas');

    if (!bboxCanvas || !videoElement) return null;

    const rect = videoElement.getBoundingClientRect();

    bboxCanvas.width = rect.width;
    bboxCanvas.height = rect.height;

    bboxCanvas.style.width = rect.width + 'px';
    bboxCanvas.style.height = rect.height + 'px';

    const ctx = bboxCanvas.getContext('2d');

    ctx.clearRect(0, 0, rect.width, rect.height);

    return {
        displayedWidth: rect.width,
        displayedHeight: rect.height,
        sourceWidth: videoElement.videoWidth,
        sourceHeight: videoElement.videoHeight
    };
}

// Draw Bounding Boxes
function drawBboxes(words, videoElement) {
    const bboxCanvas = document.getElementById('bboxCanvas');
    if (!bboxCanvas || !videoElement) {
        console.log('drawBboxes: missing bboxCanvas or videoElement', { bboxCanvas, videoElement });
        return;
    }

    console.log('drawBboxes called', {
        wordsCount: words?.length,
        videoWidth: videoElement.videoWidth,
        videoHeight: videoElement.videoHeight,
        clientWidth: videoElement.clientWidth,
        clientHeight: videoElement.clientHeight,
        hasCanvas: !!bboxCanvas
    });

    const sizes = resizeBboxCanvas(videoElement);
    if (!sizes) {
        console.log('drawBboxes: resizeBboxCanvas returned null');
        return;
    }
    if (!words || words.length === 0) {
        console.log('drawBboxes: no words to draw');
        return;
    }

    const { displayedWidth, displayedHeight, sourceWidth, sourceHeight } = sizes;
    const ctx = bboxCanvas.getContext('2d');

    const scaleX = displayedWidth / sourceWidth;
    const scaleY = displayedHeight / sourceHeight;
    console.log('drawBboxes scales', { scaleX, scaleY, displayedWidth, displayedHeight, sourceWidth, sourceHeight });

    words.forEach(word => {
        const x1 = word.x1 * scaleX;
        const y1 = word.y1 * scaleY;
        const x2 = word.x2 * scaleX;
        const y2 = word.y2 * scaleY;

        // Draw rectangle
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Draw ID label
        ctx.fillStyle = '#FF0000';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`[${word.id}]`, x1 + 2, Math.max(y1 - 5, 14));

        // Draw confidence
        ctx.fillStyle = '#00FFFF';
        ctx.font = '12px Arial';
        ctx.fillText(`${(word.conf * 100).toFixed(0)}%`, x1 + 2, Math.min(y2 + 15, displayedHeight - 2));
    });
}

async function doOcrForPausedFrame(videoElement) {
    resizeBboxCanvas(videoElement);

    try {
        if (ocrAbortController) {
            ocrAbortController.abort();
        }

        ocrAbortController = new AbortController();
        isOcrInProgress = true;
        setOcrInProgressUI(true);

        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(videoElement, 0, 0);

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) {
            throw new Error('Не удалось создать изображение для OCR');
        }

        const formData = new FormData();
        formData.append('file', blob, 'frame.png');

        const res = await fetch('/ocr', {
            method: 'POST',
            body: formData,
            signal: ocrAbortController.signal
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`OCR server error: ${res.status} ${errorText}`);
        }

        const data = await res.json();
        updateSubtitles(data.text);
        lastOcrText = data.text;
        updateTranslationResult('Перевожу...');
        const targetLang = document.getElementById('targetLangSelect')?.value || 'ru';
        await translateText(data.text, targetLang);

        if (!data.words || data.words.length === 0) {
            console.log('OCR: no bbox words returned');
        } else {
            data.words.forEach((word, index) => {
                console.log(`OCR word ${index + 1}:`, word);
            });
        }
        drawBboxes(data.words, videoElement);
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('OCR процесс был отменен');
        } else {
            console.error('Ошибка при отправке OCR запроса:', error);
            updateSubtitles('');
            updateTranslationResult('');
        }
    } finally {
        isOcrInProgress = false;
        ocrAbortController = null;
        setOcrInProgressUI(false);
    }
}

// Play Video
function playVideo(videoId) {
    const video = videos.find(v => v.id === videoId);
    if (!video) return;

    currentVideoId = videoId;
    const blob = new Blob([video.data], { type: video.type });
    const url = URL.createObjectURL(blob);

    const playerContent = document.getElementById('playerContent');
    const duration = new Date(video.size).toLocaleString();

    playerContent.innerHTML = `
        <div class="video-player" style="position: relative; display: inline-block; width: 100%; max-width: 800px;">
            <video id="videoElement" controls style="width: 100%; display: block;">
                <source src="${url}" type="${video.type}">
                Ваш браузер не поддерживает воспроизведение видео
            </video>
            <canvas id="bboxCanvas" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 20; pointer-events: none; width: 100%; height: 100%;"></canvas>
        </div>
        <div class="video-subtitles">
            <div class="subtitles-text" id="subtitlesText"></div>
            <div class="translation-panel" style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; position: relative; z-index: 10;">
                <select id="targetLangSelect" aria-label="Выбор языка для перевода">
                    <option value="ru" selected>Русский</option>
                    <option value="en">Английский</option>
                    <option value="uk">Украинский</option>
                    <option value="de">Немецкий</option>
                </select>
                <button id="translateBtn" class="back-btn">перевести</button>
                
                <div id="translationResult" style="width: 100%; margin-top: 10px; color: #1f2a48;
                    background: linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(229, 237, 255, 0.9) 100%);
                    padding: 12px 14px; border-radius: 8px; min-height: 40px;
                    white-space: pre-wrap; font-size: 13px; line-height: 1.5;
                    border: 1px solid rgba(112, 139, 209, 0.15);
                    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
                "></div>
            </div>
        </div>
        <div class="player-controls">
            <button class="back-btn" onclick="switchTab('upload')">← вернуться</button>
        </div>
    `;

    // Clear subtitles for new video
    clearSubtitles();

    // Switch to player tab
    switchTab('player');

    // Clean up URL when navigating away
    const videoElement = document.getElementById('videoElement');
    if (videoElement) {
        videoElement.addEventListener('ended', () => {
            URL.revokeObjectURL(url);
        });

        videoElement.addEventListener('loadedmetadata', () => {
            resizeBboxCanvas(videoElement);
        });

        // Resize overlay when video container changes size
        window.addEventListener('resize', () => {
            resizeBboxCanvas(videoElement);
        });
    }

    let isSeeking = false;
    let seekStartedWhilePaused = false;

    videoElement.addEventListener('seeking', () => {
        isSeeking = true;
        wasPlayingBeforeSeek = !videoElement.paused;
        seekStartedWhilePaused = videoElement.paused;
    });
    videoElement.addEventListener('seeked', async () => {
        if (seekStartedWhilePaused && videoElement.paused) {
            console.log('seeked after paused seek — запускаю OCR для нового кадра');
            await doOcrForPausedFrame(videoElement);
        }
        isSeeking = false;
        seekStartedWhilePaused = false;
    });

    videoElement.addEventListener("pause", async () => {
        console.log('video pause event fired', { currentTime: videoElement.currentTime, paused: videoElement.paused, seeking: videoElement.seeking, wasPlayingBeforeSeek });
        
        // Пропускаем OCR если видео было перемотано во время воспроизведения
        if (isSeeking && wasPlayingBeforeSeek) {
            console.log('Пропускаю OCR: перемотка произошла во время воспроизведения');
            return;
        }
        
        // При паузе на текущем кадре или после перемотки на паузе делаем OCR
        if (isSeeking && !wasPlayingBeforeSeek) {
            console.log('Распознавание текста: перемотка произошла на паузе');
        }

        await doOcrForPausedFrame(videoElement);
    });

    const translateBtn = document.getElementById('translateBtn');
    if (translateBtn) {
        translateBtn.addEventListener('click', async () => {
            if (!lastOcrText) {
                updateTranslationResult('Сначала остановите видео и дождитесь OCR');
                return;
            }
            const targetLang = document.getElementById('targetLangSelect')?.value || 'ru';
            updateTranslationResult('Перевожу...');
            await translateText(lastOcrText, targetLang);
        });
    }


    videoElement.addEventListener('play', () => {
        // Абортим OCR если видео начало воспроизводиться во время распознавания
        if (ocrAbortController && isOcrInProgress) {
            console.log('Play во время OCR - отменяю распознавание');
            ocrAbortController.abort();
            isOcrInProgress = false;
            ocrAbortController = null;
            setOcrInProgressUI(false);
        }
        
        updateSubtitles('');
        updateTranslationResult('');
        lastOcrText = '';
        const bboxCanvas = document.getElementById('bboxCanvas');
        if (bboxCanvas) {
            const ctx = bboxCanvas.getContext('2d');
            ctx.clearRect(0, 0, bboxCanvas.width, bboxCanvas.height);
        }
    });
}


// Delete Video
function deleteVideo(videoId) {
    if (confirm('Вы уверены? Это действие необратимо.')) {
        videos = videos.filter(v => v.id !== videoId);
        saveVideos();
        renderVideoList();
        if (currentVideoId === videoId) {
            currentVideoId = null;
            switchTab('upload');
        }
    }
}

// Switch Tab
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Deactivate all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Clear subtitles when switching away from player
    if (tabName !== 'player') {
        clearSubtitles();
    }
}

// Save Videos to LocalStorage
function saveVideos() {
    console.log('saveVideos вызвана, сохраняю', videos.length, 'видео');
    try {
        // For localStorage, we need to convert ArrayBuffer to base64
        const videosSerialized = videos.map(v => ({
            id: v.id,
            name: v.name,
            size: v.size,
            type: v.type,
            data: arrayBufferToBase64(v.data)
        }));
        localStorage.setItem('videos', JSON.stringify(videosSerialized));
        console.log('Видео успешно сохранены в localStorage');
    } catch (e) {
        console.error('Ошибка при сохранении видео:', e);
    }
}


// Load Videos from LocalStorage
function loadVideos() {
    console.log('loadVideos вызвана');
    const stored = localStorage.getItem('videos');
    if (stored) {
        try {
            console.log('Найдены сохраненные данные, парсю...');
            const videosSerialized = JSON.parse(stored);
            videos = videosSerialized.map(v => ({
                id: v.id,
                name: v.name,
                size: v.size,
                type: v.type,
                data: base64ToArrayBuffer(v.data)
            }));
            console.log('Загружено', videos.length, 'видео из localStorage');
            renderVideoList();
        } catch (e) {
            console.error('Ошибка при загрузке видео:', e);
            localStorage.removeItem('videos');
        }
    } else {
        console.log('Нет сохраненных данных в localStorage');
    }
}

// Update Subtitles
function updateSubtitles(text) {
    const subtitlesElement = document.getElementById('subtitlesText');
    if (subtitlesElement) {
        subtitlesElement.textContent = text || '';
    }
}

// Show/Hide Continue Button
function setOcrInProgressUI(inProgress) {
    const continueBtn = document.getElementById('continueBtn');
    if (continueBtn) {
        if (inProgress) {
            continueBtn.style.display = 'block';
            continueBtn.disabled = false;
        } else {
            continueBtn.style.display = 'none';
            continueBtn.disabled = true;
        }
    }
}

// Clear Subtitles
function clearSubtitles() {
    updateSubtitles('');
    updateTranslationResult('');
    lastOcrText = '';
}

async function translateText(text, target = 'ru') {
    if (!text) {
        updateTranslationResult('Нет текста для перевода');
        return;
    }

    try {
        const res = await fetch('/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text, target })
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(errorText || `HTTP ${res.status}`);
        }

        const data = await res.json();
        updateTranslationResult(data.translated_text || 'Перевод не получен');
        return data.translated_text;
    } catch (error) {
        console.error('Translation error:', error);
        updateTranslationResult('Ошибка перевода');
    }
}

function updateTranslationResult(text) {
    const translationResult = document.getElementById('translationResult');
    if (translationResult) {
        translationResult.textContent = text || '';
    }
}

function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

