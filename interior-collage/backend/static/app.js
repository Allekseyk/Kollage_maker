// ========================================
// ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ
// Здесь все модули объединяются и инициализируется приложение
// ========================================

// Примечание: Все модули подключаются через <script> в index.html
// Они добавляют свои функции и объекты в глобальную область видимости (window)

const btnClear = document.getElementById('btnClear');
const btnExport = document.getElementById('btnExport');
const btnDelete = document.getElementById('btnDelete');

// ========================================
// ФУНКЦИЯ ОБНОВЛЕНИЯ ИНДИКАТОРА РЕЖИМА
// ========================================

// Обновляет текст индикатора режима в зависимости от активного режима
function updateModeIndicator() {
  const modeIndicator = document.getElementById('mode-indicator');
  if (!modeIndicator) return;
  
  // Определяем текущий режим
  let modeText = '';
  
  if (window.eraserMode) {
    modeText = 'Режим: Ластик';
  } else if (window.selectionMode === 'rect') {
    modeText = 'Режим: Выделение (прямоугольник)';
  } else if (window.selectionMode === 'lasso') {
    modeText = 'Режим: Выделение (лассо)';
  } else {
    modeText = 'Режим: Обычный';
  }
  
  modeIndicator.textContent = modeText;
}

// Делаем функцию доступной глобально
window.updateModeIndicator = updateModeIndicator;

// ========================================
// ОБРАБОТЧИКИ КНОПОК ПАНЕЛИ ИНСТРУМЕНТОВ
// ========================================

// Кнопка "Очистить" - удаляет все с холста
btnClear.addEventListener('click', () => {
  // Сохраняем состояние перед очисткой
  if (typeof window.saveHistoryState === 'function') {
    window.saveHistoryState();
  }
  
  window.canvasLayer.destroyChildren();
  if (window.eraserLayer) {
    window.eraserLayer.destroyChildren();
  }
  window.activePerspectiveGroup = null;
  window.canvasTransformer.nodes([]);
  window.canvasLayer.draw();
  updateLayersList();
});

// Кнопка "Экспорт PNG" - сохраняет коллаж как изображение
btnExport.addEventListener('click', () => {
  if (window.activePerspectiveGroup) {
    hide3DTransformControls(window.activePerspectiveGroup);
  }
  window.canvasTransformer.nodes([]);
  window.canvasLayer.draw();
  const dataURL = window.canvasStage.toDataURL({ pixelRatio: 2 });
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = 'collage.png';
  a.click();
});

// Кнопка "Удалить выбранное"
btnDelete.addEventListener('click', () => {
  // Сохраняем состояние перед удалением
  if (typeof window.saveHistoryState === 'function') {
    window.saveHistoryState();
  }
  deleteSelected();
});

// ========================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ========================================

// Запускаем инициализацию после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
  console.log('Приложение Interior Collage Builder запущено');
  
  // Инициализируем каталог товаров
  initCatalog();
  
  // Инициализируем историю действий
  if (typeof window.initHistory === 'function') {
    window.initHistory();
  }
  
  // Обновляем индикатор режима
  updateModeIndicator();
  
  // Обновляем список слоёв
  updateLayersList();
  
  console.log('Инициализация завершена');
});
