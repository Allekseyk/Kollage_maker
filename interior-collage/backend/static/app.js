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
// ОБРАБОТЧИКИ КНОПОК ПАНЕЛИ ИНСТРУМЕНТОВ
// ========================================

// Кнопка "Очистить" - удаляет все с холста
btnClear.addEventListener('click', () => {
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
    hidePerspectiveControls(window.activePerspectiveGroup);
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
btnDelete.addEventListener('click', deleteSelected);

// ========================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ========================================

// Запускаем инициализацию после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
  console.log('Приложение Interior Collage Builder запущено');
  
  // Инициализируем каталог товаров
  initCatalog();
  
  // Обновляем индикатор режима
  updateModeIndicator();
  
  // Обновляем список слоёв
  updateLayersList();
  
  console.log('Инициализация завершена');
});
