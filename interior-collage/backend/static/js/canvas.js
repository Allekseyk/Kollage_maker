// ========================================
// МОДУЛЬ: CANVAS
// Отвечает за холст Konva и основные элементы
// ========================================

// DOM элементы
const stageContainer = document.getElementById('stage-container');

// Размеры холста
const width = () => stageContainer.clientWidth;
const height = () => stageContainer.clientHeight;

// Инициализация Konva Stage (главная сцена)
const stage = new Konva.Stage({
  container: 'stage-container',
  width: width(),
  height: height(),
});

// Основной слой для изображений
const layer = new Konva.Layer();
stage.add(layer);

// Трансформер для обычного режима (рамка вокруг выбранного объекта)
const transformer = new Konva.Transformer({
  rotateEnabled: true,
  keepRatio: false, // Можно растягивать свободно
  enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 
                   'top-center', 'bottom-center', 'middle-left', 'middle-right'],
});
layer.add(transformer);

// Делаем доступными глобально для других модулей
window.canvasStage = stage;
window.canvasLayer = layer;
window.canvasTransformer = transformer;

// Автоматически подстраиваем размер холста при изменении окна
window.addEventListener('resize', () => {
  stage.size({ width: width(), height: height() });
});

// Снятие выделения при клике в пустоту
stage.on('mousedown', (e) => {
  // В режиме выделения обрабатываем клики через функции из selection.js
  if (window.selectionMode && typeof startSelection === 'function') {
    startSelection(e);
    return;
  }
  
  // В режиме ластика обрабатываем клики везде
  if (window.eraserMode) {
    startEraser(e);
    return;
  }
  
  // Если кликнули на пустое место (не на изображение)
  if (e.target === stage) {
    transformer.nodes([]);
    // Убираем выделение со всех элементов
    getImageGroups().forEach(group => {
      try {
        if (group.hasName && group.hasName('selected') && group.getParent()) {
          group.removeName('selected');
        }
      } catch (e) {
        // Игнорируем ошибки для удалённых групп
      }
    });
    layer.draw();
    updateLayersList();
  }
});

stage.on('mousemove', (e) => {
  // В режиме выделения обрабатываем движение мыши
  if (window.selectionMode && window.isSelecting && typeof continueSelection === 'function') {
    continueSelection(e);
    return;
  }
  
  if (window.eraserMode && window.isEraserDrawing) {
    continueEraser(e);
  }
});

stage.on('mouseup', (e) => {
  // В режиме выделения обрабатываем отпускание мыши
  if (window.selectionMode && window.isSelecting && typeof stopSelection === 'function') {
    stopSelection();
    return;
  }
  
  if (window.eraserMode && window.isEraserDrawing) {
    stopEraser();
  }
});

// ========================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С ИЗОБРАЖЕНИЯМИ
// ========================================

// Создание группы с изображением на холсте
// img - объект Image (HTMLImageElement)
// x, y - координаты размещения
// width, height - размеры изображения
// displayName - название для отображения в панели слоёв
function createImage(img, x, y, width, height, displayName) {
  // Создаём группу для изображения
  const group = new Konva.Group({
    x: x,
    y: y,
    draggable: true, // Можно перетаскивать мышью
    isImageItem: true, // Помечаем, что это изображение (для getImageGroups)
    displayName: displayName || 'Изображение', // Название для панели слоёв
  });

  // Создаём Konva Image из HTML изображения
  const konvaImage = new Konva.Image({
    image: img,
    width: width,
    height: height,
    name: 'normal-image', // Имя для поиска в группе
  });

  // Добавляем изображение в группу
  group.add(konvaImage);

  // Обработчик клика на изображение - выделяем его
  group.on('click', (e) => {
    e.cancelBubble = true; // Останавливаем всплытие события
    
    // В режиме ластика не выделяем
    if (window.eraserMode) return;
    
    // В режиме выделения не выделяем отдельные изображения
    if (window.selectionMode) return;
    
    // Убираем выделение со всех других изображений
    getImageGroups().forEach(g => {
      if (g.hasName('selected')) {
        g.removeName('selected');
      }
    });
    
    // Выделяем текущее изображение
    group.addName('selected');
    // Проверяем, что группа существует перед добавлением в трансформер
    try {
      if (group.getParent()) {
        window.canvasTransformer.nodes([group]);
        window.canvasLayer.draw();
      }
    } catch (e) {
      console.warn('Ошибка при выделении группы:', e);
    }
    
    // Обновляем список слоёв
    if (typeof updateLayersList === 'function') {
      updateLayersList();
    }
  });

  // Обработчик начала перетаскивания - убираем трансформер, чтобы избежать конфликтов
  group.on('dragstart', () => {
    // Сохраняем информацию о том, что группа была выделена
    const currentNodes = window.canvasTransformer.nodes();
    if (currentNodes.length > 0 && currentNodes.includes(group)) {
      group.setAttr('wasSelected', true);
      // Полностью убираем трансформер из узлов перед перетаскиванием
      window.canvasTransformer.nodes([]);
      window.canvasLayer.draw();
    }
  });

  // Обработчик окончания перетаскивания - возвращаем трансформер
  group.on('dragend', () => {
    // Если группа была выделена до перетаскивания, возвращаем выделение
    if (group.getAttr('wasSelected')) {
      // Проверяем, что группа всё ещё существует и не удалена
      try {
        if (group.getParent() && group.getParent().getChildren().includes(group)) {
          // Небольшая задержка, чтобы Konva успел завершить все операции
          setTimeout(() => {
            try {
              if (group.getParent() && group.hasName('selected')) {
                window.canvasTransformer.nodes([group]);
                window.canvasLayer.draw();
              }
            } catch (e) {
              console.warn('Ошибка при восстановлении трансформера:', e);
            }
          }, 10);
        }
      } catch (e) {
        console.warn('Ошибка при проверке группы после перетаскивания:', e);
      }
      group.setAttr('wasSelected', false);
    }
    
    // Обновляем список слоёв после перемещения
    if (typeof updateLayersList === 'function') {
      updateLayersList();
    }
  });

  return group;
}

// Добавление изображения на холст по URL
// imageUrl - URL изображения (например, '/api/image/123' или 'https://...')
// displayName - название для отображения в панели слоёв
function addImageToCanvas(imageUrl, displayName) {
  // Сохраняем состояние перед добавлением (для истории отмены)
  if (typeof window.saveHistoryState === 'function') {
    window.saveHistoryState();
  }

  // Создаём HTML элемент Image
  const img = new Image();
  
  // Разрешаем загрузку изображений с других доменов (CORS)
  img.crossOrigin = 'anonymous';
  
  // Обработчик успешной загрузки изображения
  img.onload = function() {
    // Вычисляем размеры для отображения (чтобы изображение поместилось на холст)
    const maxWidth = window.canvasStage.width() * 0.6; // 60% от ширины холста
    const maxHeight = window.canvasStage.height() * 0.6; // 60% от высоты холста
    
    // Вычисляем масштаб, чтобы изображение поместилось
    const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
    const displayWidth = img.width * scale;
    const displayHeight = img.height * scale;
    
    // Размещаем в центре холста
    const x = window.canvasStage.width() / 2 - displayWidth / 2;
    const y = window.canvasStage.height() / 2 - displayHeight / 2;
    
    // Создаём группу с изображением
    const group = createImage(img, x, y, displayWidth, displayHeight, displayName);
    
    // Добавляем группу на слой
    window.canvasLayer.add(group);
    
    // Автоматически выделяем новое изображение
    group.addName('selected');
    window.canvasTransformer.nodes([group]);
    
    // Перерисовываем холст
    window.canvasLayer.draw();
    
    // Обновляем список слоёв
    if (typeof updateLayersList === 'function') {
      updateLayersList();
    }
  };
  
  // Обработчик ошибки загрузки
  img.onerror = function() {
    console.error('Не удалось загрузить изображение:', imageUrl);
    alert('Не удалось загрузить изображение. Проверьте URL.');
  };
  
  // Начинаем загрузку изображения
  img.src = imageUrl;
}

// Делаем функции доступными глобально для других модулей
window.createImage = createImage;
window.addImageToCanvas = addImageToCanvas;

