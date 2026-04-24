// State
let videos = [];
let currentVideoId = null;

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
        <div class="video-player">
            <video id="videoElement" controls>
                <source src="${url}" type="${video.type}">
                Ваш браузер не поддерживает воспроизведение видео
            </video>
        </div>
        <div class="video-subtitles">
            <div class="subtitles-text" id="subtitlesText"></div>
        </div>
        <div class="player-controls">
            <button class="back-btn" onclick="switchTab('upload')">←вернуться к загрузке</button>
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
    }
    videoElement.addEventListener('pause', () => {
    updateSubtitles('перевода пока что нет :(');
    });
    videoElement.addEventListener('play', () => {
    updateSubtitles('');

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

// Clear Subtitles
function clearSubtitles() {
   
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
