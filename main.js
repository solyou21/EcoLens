/**
 * EcoScan - AI Trash Scanner Web Application
 * main.js - Core functionality (Camera, File upload, Gemini API integration, and History management)
 */

// --- Constants & State ---
let cameraStream = null;
let activeImageBase64 = null; // Stores the base64 string of the current captured/uploaded image (without data URL prefix)
let activeImageMimeType = null; // Stores mimeType (e.g., 'image/jpeg')

const APP_STATE = {
  activeTab: 'camera', // 'camera' | 'upload'
  apiKey: localStorage.getItem('ecoscan_gemini_api_key') || '',
  isDemoMode: localStorage.getItem('ecoscan_demo_mode') === 'true',
  history: JSON.parse(localStorage.getItem('ecoscan_history')) || []
};

// --- Mock Data for Demo Mode ---
const MOCK_SCAN_RESULTS = [
  {
    waste_name: "생수 페트병 (PET)",
    category: "plastic",
    confidence: "98%",
    disposal_instructions: [
      "내용물을 완전히 비우고 물로 헹궈서 깨끗이 해주세요.",
      "페트병 겉면의 플라스틱 비닐 라벨을 완전히 떼어내어 비닐류로 따로 분리배출 하세요.",
      "부피를 줄이기 위해 발로 밟아 압착한 후 뚜껑을 닫아 플라스틱(또는 투명 페트병 전용 수거함)으로 배출하세요."
    ],
    eco_tip: "투명 페트병은 고품질 재생 섬유로 가공되어 옷이나 가방 등으로 재탄생됩니다! 라벨 떼기가 가장 핵심입니다.",
    warning: "색상이 있는 음료 페트병은 투명 페트병 전용 수거함이 아닌 일반 플라스틱 수거함에 버려주세요.",
    carbon_saved: 0.15
  },
  {
    waste_name: "테이크아웃 일회용 종이컵",
    category: "paper",
    confidence: "94%",
    disposal_instructions: [
      "남은 음료를 비우고 물로 가볍게 헹구어 이물질을 제거합니다.",
      "일반 종이 박스류와 섞이지 않도록 '종이팩/종이컵' 전용 수거함에 따로 배출해 주세요.",
      "전용 수거함이 없다면 일반 쓰레기(종량제 봉투)로 분류 배출해야 할 수도 있습니다."
    ],
    eco_tip: "일반 일회용 종이컵은 내부가 플라스틱(PE) 코팅되어 있어 일반 종이류와 섞이면 재활용되지 못하고 소각됩니다. 따로 모아야 고급 화장지로 재탄생합니다.",
    warning: "이물질이 묻어 오염이 심한 종이컵은 재활용할 수 없으므로 일반 쓰레기로 버려야 합니다.",
    carbon_saved: 0.06
  },
  {
    waste_name: "맥주 유리병",
    category: "glass",
    confidence: "96%",
    disposal_instructions: [
      "병 내부의 이물질을 완전히 비우고 가볍게 물로 헹굽니다.",
      "유리병 뚜껑(철재 또는 플라스틱)은 분리하여 각각 재질에 맞게 배출하세요.",
      "유리 수거함에 배출하되, 소주병/맥주병 등 빈용기보증금 마크가 있는 병은 대형마트나 편의점에 반납하여 보증금을 환급받으실 수 있습니다."
    ],
    eco_tip: "빈용기보증금 제도를 이용하면 환경도 보호하고 100원~150원 가량의 보증금도 돌려받을 수 있습니다.",
    warning: "깨진 유리, 거울, 사기그릇, 내열유리 식기는 재활용이 되지 않으므로 전용 마대(불연성 쓰레기 봉투)에 담아 버리셔야 합니다.",
    carbon_saved: 0.28
  },
  {
    waste_name: "탄산음료 알루미늄 캔",
    category: "metal",
    confidence: "99%",
    disposal_instructions: [
      "음료를 비우고 내부를 세척합니다.",
      "캔 겉면의 플라스틱 뚜껑이나 빨대 등 다른 재질을 분리합니다.",
      "밟아서 납작하게 눌러 부피를 줄인 뒤 캔 수거함(철/알루미늄)에 배출하세요."
    ],
    eco_tip: "알루미늄 캔을 재활용하면 원석에서 알루미늄을 새로 생산할 때보다 에너지를 무려 95%나 절약할 수 있습니다.",
    warning: "",
    carbon_saved: 0.35
  },
  {
    waste_name: "부탄가스 캔",
    category: "hazardous",
    confidence: "97%",
    disposal_instructions: [
      "안전사고 예방을 위해 화기가 없는 통풍이 잘되는 야외로 이동합니다.",
      "노즐을 눌러 가스를 완전히 배출하여 비웁니다.",
      "캔 가스 제거기나 송곳을 이용하여 바닥면에 구멍을 뚫어 잔여 가스를 방출한 후 고철류(캔)로 배출하세요."
    ],
    eco_tip: "가스가 남아있는 상태로 쓰레기 수거차량이나 처리장에 가며 압착 과정에서 폭발이나 화재 사고가 발생할 수 있습니다. 가스 배출은 생명과 직결되는 필수 절차입니다!",
    warning: "바람이 잘 통하는 야외에서 작업해야 하며, 불꽃이 튀어 화재가 발생하지 않도록 주의하세요.",
    carbon_saved: 0.20
  },
  {
    waste_name: "라면 봉지 (비닐 포장재)",
    category: "vinyl",
    confidence: "92%",
    disposal_instructions: [
      "과자나 라면 스프 등의 가루와 내용물을 깨끗이 비워냅니다.",
      "내부에 기름기나 양념이 묻어있다면 물로 씻거나 닦아내세요.",
      "흩날리지 않도록 차곡차곡 접거나 모아서 비닐류 수거함에 배출합니다."
    ],
    eco_tip: "비닐류 포장재는 고온에서 열분해하여 재생 오일이나 산업용 연료로 재탄생하는 훌륭한 자원입니다.",
    warning: "오염물질(양념 등)이 도저히 지워지지 않는 비닐이나 테이프가 붙은 비닐은 재활용 불가하므로 일반 쓰레기로 버려야 합니다.",
    carbon_saved: 0.08
  },
  {
    waste_name: "바나나 껍질",
    category: "food",
    confidence: "95%",
    disposal_instructions: [
      "수분을 최대한 제거하고 이물질(비닐 딱지 등)이 섞이지 않도록 합니다.",
      "음식물 쓰레기 전용 수거함이나 전용 종량제 봉투에 넣어 배출하세요."
    ],
    eco_tip: "과일 껍질은 훌륭한 가축 사료나 퇴비로 재활용됩니다. 따라서 동물이 먹을 수 있는 부드러운 상태의 껍질만 음식물 쓰레기로 버려야 합니다.",
    warning: "딱딱한 파인애플 껍질, 조개껍데기, 달걀껍질, 육류의 뼈다귀 등은 동물 사료로 쓸 수 없으므로 일반 쓰레기(종량제)로 분류해야 합니다.",
    carbon_saved: 0.05
  }
];

// --- DOM Elements ---
const videoStreamEl = document.getElementById('video-stream');
const cameraPlaceholderEl = document.querySelector('.camera-placeholder');
const btnStartCamera = document.getElementById('btn-start-camera');
const btnCapture = document.getElementById('btn-capture');
const btnAnalyze = document.getElementById('btn-analyze');
const btnResetPreview = document.getElementById('btn-reset-preview');
const fileInput = document.getElementById('file-input');
const btnSelectFile = document.getElementById('btn-select-file');
const dropZone = document.getElementById('drop-zone');
const previewImage = document.getElementById('preview-image');
const scannerLaser = document.getElementById('scanner-laser');

const cameraView = document.getElementById('camera-view');
const uploadView = document.getElementById('upload-view');
const previewView = document.getElementById('preview-view');
const cameraControls = document.getElementById('camera-controls');
const reviewControls = document.getElementById('review-controls');

const tabCamera = document.getElementById('tab-camera');
const tabUpload = document.getElementById('tab-upload');

const stateIdle = document.getElementById('state-idle');
const stateLoading = document.getElementById('state-loading');
const stateResult = document.getElementById('state-result');
const stateError = document.getElementById('state-error');
const errorMessageEl = document.getElementById('error-message');
const btnErrorRetry = document.getElementById('btn-error-retry');

const resCategory = document.getElementById('res-category');
const resConfidence = document.getElementById('res-confidence');
const resName = document.getElementById('res-name');
const resInstructions = document.getElementById('res-instructions');
const resEcoTip = document.getElementById('res-eco-tip');
const resEcoTipWrapper = document.getElementById('res-eco-tip-wrapper');
const resWarning = document.getElementById('res-warning');
const resWarningWrapper = document.getElementById('res-warning-wrapper');
const resCarbon = document.getElementById('res-carbon');

const btnApiSettings = document.getElementById('btn-api-settings');
const apiModal = document.getElementById('api-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnSaveApi = document.getElementById('btn-save-api');
const inputApiKey = document.getElementById('input-api-key');
const btnToggleKeyVisibility = document.getElementById('btn-toggle-key-visibility');
const iconEye = document.getElementById('icon-eye');
const checkboxDemoMode = document.getElementById('checkbox-demo-mode');

const btnClearHistory = document.getElementById('btn-clear-history');
const statTotalScans = document.getElementById('stat-total-scans');
const statCarbonSaved = document.getElementById('stat-carbon-saved');
const historyEmpty = document.getElementById('history-empty');
const historyList = document.getElementById('history-list');

// --- Initialization ---
function init() {
  lucide.createIcons();
  
  // Set initial settings state
  inputApiKey.value = APP_STATE.apiKey;
  checkboxDemoMode.checked = APP_STATE.isDemoMode;
  
  // Update key visibility icon on load
  updateEyeIcon();

  // If no API key and not in demo mode, show settings modal automatically to nudge the user
  if (!APP_STATE.apiKey && !APP_STATE.isDemoMode) {
    setTimeout(() => {
      openSettingsModal();
    }, 800);
  }

  // Bind Event Listeners
  bindEvents();
  
  // Render Scan History
  renderHistory();
}

// --- Event Handlers & Binding ---
function bindEvents() {
  // Tab switches
  tabCamera.addEventListener('click', () => switchTab('camera'));
  tabUpload.addEventListener('click', () => switchTab('upload'));

  // Camera Actions
  btnStartCamera.addEventListener('click', startCamera);
  btnCapture.addEventListener('click', capturePhoto);
  btnResetPreview.addEventListener('click', resetToActiveTab);

  // Upload Actions
  btnSelectFile.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop for upload zone
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', handleFileDrop, false);

  // Analysis Trigger
  btnAnalyze.addEventListener('click', startAnalysis);
  btnErrorRetry.addEventListener('click', startAnalysis);

  // Modal Dialog Actions
  btnApiSettings.addEventListener('click', openSettingsModal);
  btnCloseModal.addEventListener('click', closeSettingsModal);
  btnSaveApi.addEventListener('click', saveSettings);
  btnToggleKeyVisibility.addEventListener('click', toggleKeyVisibility);
  
  // Close modal when clicking outside
  apiModal.addEventListener('click', (e) => {
    if (e.target === apiModal) closeSettingsModal();
  });

  // History Actions
  btnClearHistory.addEventListener('click', clearAllHistory);
}

// --- UI Navigation & Tabs ---
function switchTab(tabName) {
  if (APP_STATE.activeTab === tabName) return;
  
  APP_STATE.activeTab = tabName;
  tabCamera.classList.toggle('active', tabName === 'camera');
  tabUpload.classList.toggle('active', tabName === 'upload');

  resetToActiveTab();
}

function resetToActiveTab() {
  // Stop existing camera stream if we switch away or reset
  stopCamera();
  
  // Hide preview/review mode
  previewView.classList.remove('active');
  reviewControls.classList.remove('active');
  activeImageBase64 = null;
  activeImageMimeType = null;
  
  if (APP_STATE.activeTab === 'camera') {
    cameraView.classList.add('active');
    cameraControls.classList.add('active');
    uploadView.classList.remove('active');
    
    // Automatically try to start camera for convenience
    startCamera();
  } else {
    uploadView.classList.add('active');
    cameraControls.classList.remove('active');
    cameraView.classList.remove('active');
    fileInput.value = ''; // Reset file input
  }

  // Restore results view state to idle/welcome if it was in error/results
  setResultState('idle');
}

function setResultState(state) {
  stateIdle.classList.toggle('active', state === 'idle');
  stateLoading.classList.toggle('active', state === 'loading');
  stateResult.classList.toggle('active', state === 'result');
  stateError.classList.toggle('active', state === 'error');
}

// --- Camera Logic ---
async function startCamera() {
  cameraPlaceholderEl.style.display = 'none';
  btnCapture.disabled = true;

  const constraints = {
    video: {
      facingMode: { ideal: "environment" }, // Prefer rear camera on mobile
      width: { ideal: 1280 },
      height: { ideal: 720 }
    },
    audio: false
  };

  try {
    if (cameraStream) {
      stopCamera();
    }
    
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    videoStreamEl.srcObject = cameraStream;
    videoStreamEl.style.display = 'block';
    btnCapture.disabled = false;
  } catch (err) {
    console.error("Camera access error:", err);
    videoStreamEl.style.display = 'none';
    cameraPlaceholderEl.style.display = 'flex';
    btnCapture.disabled = true;
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  videoStreamEl.srcObject = null;
}

function capturePhoto() {
  if (!cameraStream) return;

  // Create temporary canvas to draw video frame
  const canvas = document.createElement('canvas');
  canvas.width = videoStreamEl.videoWidth || 640;
  canvas.height = videoStreamEl.videoHeight || 480;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(videoStreamEl, 0, 0, canvas.width, canvas.height);
  
  // Convert frame to base64 jpeg
  const dataUrl = canvas.toDataURL('image/jpeg');
  
  // Set preview screen
  showImagePreview(dataUrl, 'image/jpeg');
  
  // Stop camera to release hardware resource
  stopCamera();
}

// --- File Handling Logic ---
function handleFileSelect(e) {
  const file = e.target.files[0];
  processUploadedFile(file);
}

function handleFileDrop(e) {
  const file = e.dataTransfer.files[0];
  processUploadedFile(file);
}

function processUploadedFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    alert("이미지 파일만 선택할 수 있습니다.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    showImagePreview(event.target.result, file.type);
  };
  reader.readAsDataURL(file);
}

function showImagePreview(dataUrl, mimeType) {
  previewImage.src = dataUrl;
  
  // Save base64 chunk without the prefix "data:image/jpeg;base64,"
  activeImageBase64 = dataUrl.split(',')[1];
  activeImageMimeType = mimeType;

  // Switch viewer container content to preview
  cameraView.classList.remove('active');
  uploadView.classList.remove('active');
  previewView.classList.add('active');

  // Toggle controls to show 'AI Analyze'
  cameraControls.classList.remove('active');
  reviewControls.classList.add('active');
}

// --- Settings Modal Logic ---
function openSettingsModal() {
  apiModal.classList.add('active');
}

function closeSettingsModal() {
  apiModal.classList.remove('active');
}

function toggleKeyVisibility() {
  if (inputApiKey.type === 'password') {
    inputApiKey.type = 'text';
  } else {
    inputApiKey.type = 'password';
  }
  updateEyeIcon();
}

function updateEyeIcon() {
  if (inputApiKey.type === 'password') {
    iconEye.setAttribute('data-lucide', 'eye');
  } else {
    iconEye.setAttribute('data-lucide', 'eye-off');
  }
  lucide.createIcons();
}

function saveSettings() {
  const key = inputApiKey.value.trim();
  const demo = checkboxDemoMode.checked;

  APP_STATE.apiKey = key;
  APP_STATE.isDemoMode = demo;

  localStorage.setItem('ecoscan_gemini_api_key', key);
  localStorage.setItem('ecoscan_demo_mode', demo ? 'true' : 'false');

  closeSettingsModal();
}

// --- Gemini AI & Analysis Logic ---
async function startAnalysis() {
  if (!activeImageBase64) return;

  // Check key if not in demo mode
  if (!APP_STATE.isDemoMode && !APP_STATE.apiKey) {
    alert("Gemini API 설정에서 API 키를 입력하거나 데모 모드를 활성화해 주세요.");
    openSettingsModal();
    return;
  }

  setResultState('loading');
  scannerLaser.classList.add('scanning');

  try {
    let result = null;

    if (APP_STATE.isDemoMode) {
      // Simulate API latency
      result = await simulateDemoAnalysis();
    } else {
      // Direct call to Gemini API
      result = await callGeminiAPI(activeImageBase64, activeImageMimeType);
    }

    displayResult(result);
    saveToHistory(result);
  } catch (error) {
    console.error("Analysis Error:", error);
    errorMessageEl.textContent = error.message || "분석 도중 알 수 없는 에러가 발생했습니다.";
    setResultState('error');
  } finally {
    scannerLaser.classList.remove('scanning');
  }
}

async function simulateDemoAnalysis() {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Select random item from mock DB
      const randomIndex = Math.floor(Math.random() * MOCK_SCAN_RESULTS.length);
      resolve({ ...MOCK_SCAN_RESULTS[randomIndex] });
    }, 2000);
  });
}

async function callGeminiAPI(base64Data, mimeType) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent?key=${APP_STATE.apiKey}`;

  const promptText = `
    Identify the waste/trash item in this image. 
    Analyze its material structure and output a strict JSON structure containing the details.
    
    The response MUST be valid JSON matching this schema:
    {
      "waste_name": "Korean name of the item (e.g. 생수 페트병, 찌그러진 알루미늄 캔)",
      "category": "One of these exact strings: 'plastic', 'paper', 'glass', 'metal', 'vinyl', 'general', 'food', 'hazardous'",
      "confidence": "Estimation percentage (e.g., '95%')",
      "disposal_instructions": ["Array of Korean strings showing sequential, step-by-step proper recycling methods"],
      "eco_tip": "One concise Korean tip or fact that highlights the ecological benefit or importance of recycling this correctly.",
      "warning": "Additional safety warning (Korean) if applicable (e.g. gas venting warnings for butane cans, sharp glass warning, battery safety, etc.). Leave empty string if none.",
      "carbon_saved": 0.15 // float representing estimated CO2 saved (kg) by recycling this item correctly, range between 0.05 and 0.50
    }

    Do not include any markdown format tags like \`\`\`json or \`\`\` around the output. Output ONLY the JSON block.
  `;

  const payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error?.message || `HTTP error! status: ${response.status}`;
    throw new Error(`Gemini API 요청 실패: ${message}`);
  }

  const responseData = await response.json();
  
  try {
    const textResult = responseData.candidates[0].content.parts[0].text;
    const jsonResult = JSON.parse(textResult.trim());
    return jsonResult;
  } catch (parseError) {
    console.error("JSON parsing error on Gemini response", parseError, responseData);
    throw new Error("Gemini 응답 구조 분석 실패: 올바른 JSON 포맷을 반환하지 못했습니다.");
  }
}

function displayResult(result) {
  // Translate categories to Korean label
  const categoryNames = {
    plastic: '플라스틱',
    paper: '종이류',
    glass: '유리병',
    metal: '고철류 (캔)',
    vinyl: '비닐류',
    general: '일반쓰레기',
    food: '음식물쓰레기',
    hazardous: '폐기물/유해물'
  };

  // Map classes to badge
  resCategory.className = 'category-badge';
  resCategory.classList.add(`cat-${result.category}`);
  resCategory.textContent = categoryNames[result.category] || result.category.toUpperCase();

  resConfidence.textContent = result.confidence || '90%';
  resName.textContent = result.waste_name;

  // Build bulleted lists of instructions
  resInstructions.innerHTML = '';
  if (Array.isArray(result.disposal_instructions)) {
    result.disposal_instructions.forEach(inst => {
      const li = document.createElement('li');
      li.textContent = inst;
      resInstructions.appendChild(li);
    });
  }

  // Eco Tip
  if (result.eco_tip) {
    resEcoTipWrapper.style.display = 'block';
    resEcoTip.textContent = result.eco_tip;
  } else {
    resEcoTipWrapper.style.display = 'none';
  }

  // Warning
  if (result.warning) {
    resWarningWrapper.style.display = 'block';
    resWarning.textContent = result.warning;
  } else {
    resWarningWrapper.style.display = 'none';
  }

  // Carbon reduction
  resCarbon.textContent = `${result.carbon_saved || 0.1}kg`;

  // Render view state
  setResultState('result');
  lucide.createIcons();
}

// --- History Management Logic ---
function saveToHistory(result) {
  const historyItem = {
    id: Date.now().toString(),
    waste_name: result.waste_name,
    category: result.category,
    confidence: result.confidence,
    disposal_instructions: result.disposal_instructions,
    eco_tip: result.eco_tip,
    warning: result.warning,
    carbon_saved: result.carbon_saved || 0.1,
    date: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  };

  // Store in state (prepend so latest is first)
  APP_STATE.history.unshift(historyItem);
  
  // Cap history at 50 items to prevent storage bloat
  if (APP_STATE.history.length > 50) {
    APP_STATE.history.pop();
  }

  localStorage.setItem('ecoscan_history', JSON.stringify(APP_STATE.history));
  renderHistory();
}

function renderHistory() {
  const history = APP_STATE.history;
  
  // Update stats
  statTotalScans.textContent = history.length;
  
  const totalCarbon = history.reduce((acc, item) => acc + (item.carbon_saved || 0), 0);
  statCarbonSaved.textContent = `${totalCarbon.toFixed(2)} kg`;

  if (history.length === 0) {
    historyEmpty.style.display = 'block';
    historyList.style.display = 'none';
    return;
  }

  historyEmpty.style.display = 'none';
  historyList.style.display = 'flex';
  historyList.innerHTML = '';

  const categoryNames = {
    plastic: '플라스틱',
    paper: '종이류',
    glass: '유리병',
    metal: '고철류',
    vinyl: '비닐류',
    general: '일반쓰레기',
    food: '음식물',
    hazardous: '유해물'
  };

  history.forEach(item => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.dataset.id = item.id;
    
    li.innerHTML = `
      <div class="history-item-left">
        <span class="history-dot category-${item.category}"></span>
        <span class="history-name">${item.waste_name}</span>
        <span class="history-date">${item.date}</span>
      </div>
      <div class="history-item-right">
        <span class="history-cat">${categoryNames[item.category] || item.category}</span>
        <button class="btn-icon-delete" title="기록 지우기" data-id="${item.id}">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;

    // Click on history item loads it to result card
    li.addEventListener('click', (e) => {
      // Don't trigger load if clicking delete button
      if (e.target.closest('.btn-icon-delete')) return;
      loadHistoryItem(item.id);
    });

    // Wire delete button
    const deleteBtn = li.querySelector('.btn-icon-delete');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevents loading the item
      deleteHistoryItem(item.id);
    });

    historyList.appendChild(li);
  });

  lucide.createIcons();
}

function loadHistoryItem(id) {
  const item = APP_STATE.history.find(h => h.id === id);
  if (!item) return;

  // Emulate loading the specific item into the display
  displayResult({
    waste_name: item.waste_name,
    category: item.category,
    confidence: item.confidence,
    disposal_instructions: item.disposal_instructions,
    eco_tip: item.eco_tip,
    warning: item.warning,
    carbon_saved: item.carbon_saved
  });
}

function deleteHistoryItem(id) {
  APP_STATE.history = APP_STATE.history.filter(h => h.id !== id);
  localStorage.setItem('ecoscan_history', JSON.stringify(APP_STATE.history));
  renderHistory();
}

function clearAllHistory() {
  if (APP_STATE.history.length === 0) return;
  if (confirm("정말로 모든 스캔 기록을 삭제하시겠습니까? 탄소 저감량 기록도 초기화됩니다.")) {
    APP_STATE.history = [];
    localStorage.removeItem('ecoscan_history');
    renderHistory();
  }
}

// --- Start the App ---
document.addEventListener('DOMContentLoaded', init);
