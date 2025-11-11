// ========================================
// МОДУЛЬ: HISTORY (История действий)
// Отвечает за отмену действий через Ctrl+Z
// ========================================

// Массив для хранения истории состояний холста
window.historyStates = [];
// Текущая позиция в истории (индекс последнего сохранённого состояния)
window.historyIndex = -1;
// Максимальное количество состояний в истории (чтобы не перегружать память)
const MAX_HISTORY_SIZE = 50;

// Сохранение текущего состояния холста
function saveHistoryState() {
  // Проверяем, что холст инициализирован
  if (!window.canvasStage || !window.canvasLayer) {
    console.warn('Холст не инициализирован, не могу сохранить состояние');
    return;
  }

  try {
    // Сохраняем состояние всего stage в формате JSON
    // Это сохраняет все объекты, их позиции, размеры, трансформации и т.д.
    const state = window.canvasStage.toJSON();
    
    // Удаляем все состояния после текущей позиции (если мы откатились назад и делаем новое действие)
    if (window.historyIndex < window.historyStates.length - 1) {
      window.historyStates = window.historyStates.slice(0, window.historyIndex + 1);
    }
    
    // Добавляем новое состояние в историю
    window.historyStates.push(state);
    window.historyIndex++;
    
    // Ограничиваем размер истории (удаляем самые старые состояния)
    if (window.historyStates.length > MAX_HISTORY_SIZE) {
      window.historyStates.shift(); // Удаляем первое (самое старое) состояние
      window.historyIndex--;
    }
    
    console.log(`Состояние сохранено. История: ${window.historyIndex + 1}/${window.historyStates.length}`);
  } catch (error) {
    console.error('Ошибка при сохранении состояния:', error);
  }
}

// Отмена последнего действия (шаг назад)
function undoHistory() {
  // Проверяем, что есть что отменять
  if (window.historyIndex < 0) {
    console.log('Нет действий для отмены');
    return;
  }
  
  // Если мы на последнем состоянии, сохраняем его перед отменой
  // (на случай, если пользователь хочет вернуться назад)
  if (window.historyIndex === window.historyStates.length - 1) {
    // Сохраняем текущее состояние перед отменой
    const currentState = window.canvasStage.toJSON();
    window.historyStates.push(currentState);
  }
  
  // Переходим к предыдущему состоянию
  window.historyIndex--;
  
  // Восстанавливаем состояние холста
  restoreHistoryState(window.historyIndex);
  
  console.log(`Отмена выполнена. История: ${window.historyIndex + 1}/${window.historyStates.length}`);
}

// Восстановление состояния холста из истории
function restoreHistoryState(index) {
  if (index < 0 || index >= window.historyStates.length) {
    console.warn('Неверный индекс истории:', index);
    return;
  }
  
  try {
    const state = window.historyStates[index];
    
    // Сохраняем ссылку на текущий контейнер
    const container = window.canvasStage.container();
    
    // Удаляем старый stage
    window.canvasStage.destroy();
    
    // Создаём новый stage из сохранённого состояния
    window.canvasStage = Konva.Stage.fromJSON(state);
    
    // Устанавливаем контейнер обратно
    window.canvasStage.container(container);
    
    // Обновляем глобальные ссылки на элементы
    // Ищем layer по имени или берём первый слой
    const layers = window.canvasStage.getLayers();
    if (layers.length > 0) {
      window.canvasLayer = layers[0];
    } else {
      // Если слоя нет, создаём новый
      window.canvasLayer = new Konva.Layer();
      window.canvasStage.add(window.canvasLayer);
    }
    
    // Ищем трансформер или создаём новый
    window.canvasTransformer = window.canvasLayer.findOne('.transformer');
    if (!window.canvasTransformer) {
      // Ищем трансформер среди всех дочерних элементов
      const children = window.canvasLayer.getChildren();
      window.canvasTransformer = children.find(child => child.getType && child.getType() === 'Transformer');
      
      if (!window.canvasTransformer) {
        // Создаём новый трансформер
        window.canvasTransformer = new Konva.Transformer({
          rotateEnabled: true,
          keepRatio: false,
          enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 
                          'top-center', 'bottom-center', 'middle-left', 'middle-right'],
        });
        window.canvasLayer.add(window.canvasTransformer);
      }
    }
    
    // Восстанавливаем eraserLayer, если он был
    const allLayers = window.canvasStage.getLayers();
    if (allLayers.length > 1) {
      // Ищем слой ластика (обычно это второй слой)
      window.eraserLayer = allLayers.find(layer => layer !== window.canvasLayer) || null;
    } else {
      // Если слоя ластика нет, создаём его при необходимости
      window.eraserLayer = null;
    }
    
    // Восстанавливаем обработчики событий для всех изображений
    restoreImageHandlers();
    
    // Восстанавливаем обработчики событий для stage
    restoreStageHandlers();
    
    // Обновляем отображение
    window.canvasLayer.draw();
    
    // Обновляем список слоёв
    if (typeof updateLayersList === 'function') {
      updateLayersList();
    }
    
    console.log('Состояние восстановлено из истории');
  } catch (error) {
    console.error('Ошибка при восстановлении состояния:', error);
  }
}

// Восстановление обработчиков событий для stage
function restoreStageHandlers() {
  // Обработчик изменения размера окна уже работает глобально в canvas.js
  // Не нужно его восстанавливать отдельно
  
  // Восстанавливаем обработчики кликов на stage
  window.canvasStage.off('mousedown mousemove mouseup');
  
  window.canvasStage.on('mousedown', (e) => {
    if (window.eraserMode) {
      if (typeof startEraser === 'function') {
        startEraser(e);
      }
      return;
    }
    
    if (e.target === window.canvasStage) {
      window.canvasTransformer.nodes([]);
      getImageGroups().forEach(group => {
        if (group.hasName('selected')) {
          group.removeName('selected');
        }
      });
      window.canvasLayer.draw();
      if (typeof updateLayersList === 'function') {
        updateLayersList();
      }
    }
  });
  
  window.canvasStage.on('mousemove', (e) => {
    if (window.eraserMode && window.isEraserDrawing) {
      if (typeof continueEraser === 'function') {
        continueEraser(e);
      }
    }
  });
  
  window.canvasStage.on('mouseup', (e) => {
    if (window.eraserMode && window.isEraserDrawing) {
      if (typeof stopEraser === 'function') {
        stopEraser();
      }
    }
  });
}

// Восстановление обработчиков событий для изображений после загрузки из JSON
function restoreImageHandlers() {
  const groups = getImageGroups();
  
  groups.forEach(group => {
    // Восстанавливаем свойства групп (якоря, углы и т.д.)
    restoreGroupProperties(group);
    
    // Восстанавливаем обработчики клика для изображений
    const normalImage = group.findOne('.normal-image');
    const perspectiveShape = group.findOne('.perspective-image');
    
    if (normalImage) {
      normalImage.off('click'); // Удаляем старые обработчики
      normalImage.on('click', function(e) {
        handleImageClick.call(group, e);
      });
    }
    
    if (perspectiveShape) {
      perspectiveShape.off('click');
      perspectiveShape.on('click', function(e) {
        handleImageClick.call(group, e);
      });
    }
    
    // Восстанавливаем обработчики перетаскивания
    group.off('dragstart dragend');
    group.on('dragstart', function() {
    });
    
    group.on('dragend', function() {
      if (typeof updateLayersList === 'function') {
        updateLayersList();
      }
    });
    
    // Восстанавливаем обработчики якорей перспективы
    if (group.anchors && Array.isArray(group.anchors)) {
      group.anchors.forEach((anchor, index) => {
        anchor.off('dragmove');
        anchor.on('dragmove', function() {
          if (group.corners && group.corners[index]) {
            group.corners[index].x = this.x();
            group.corners[index].y = this.y();
            window.canvasLayer.draw();
          }
        });
      });
    }
  });
}

// Восстановление свойств группы после загрузки из JSON
function restoreGroupProperties(group) {
  // Ищем якоря по имени
  const anchors = [];
  const anchorNames = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
  
  anchorNames.forEach(name => {
    const anchor = group.findOne(`.anchor-${name}`);
    if (anchor) {
      anchors.push(anchor);
    }
  });
  
  // Если нашли якоря, восстанавливаем свойства группы
  if (anchors.length === 4) {
    group.anchors = anchors;
    
    // Восстанавливаем углы из позиций якорей
    if (!group.corners) {
      group.corners = anchors.map(anchor => ({
        x: anchor.x(),
        y: anchor.y()
      }));
    }
    
    // Восстанавливаем функцию updateMode, если она есть
    const normalImage = group.findOne('.normal-image');
    const perspectiveShape = group.findOne('.perspective-image');
    
    if (normalImage && perspectiveShape) {
      group.normalImage = normalImage;
      group.perspectiveShape = perspectiveShape;
      
      // Восстанавливаем функцию updateMode (если нужна)
      // Для Free Transform Tool это не требуется, так как логика другая
    }
    
    // Восстанавливаем ссылку на исходное изображение
    if (normalImage && normalImage.image()) {
      group.originalImage = normalImage.image();
    }
  }
}

// Обработчик клика на изображение (используется при восстановлении)
function handleImageClick(e) {
  const group = this; // this = группа изображения
  
  if (window.eraserMode) {
    if (typeof startEraser === 'function') {
      startEraser(e);
    }
    return;
  }
  
  getImageGroups().forEach(g => {
    if (g !== group && g.hasName('selected')) {
      g.removeName('selected');
    }
  });
  window.canvasTransformer.nodes([group]);
  group.addName('selected');
  window.canvasLayer.draw();
  if (typeof updateLayersList === 'function') {
    updateLayersList();
  }
}

// Обработчик клавиатуры для Ctrl+Z
window.addEventListener('keydown', (e) => {
  // Проверяем, что пользователь не вводит текст в поле ввода
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (tag.toLowerCase() === 'input' || tag.toLowerCase() === 'textarea') {
    return; // Не обрабатываем Ctrl+Z, если пользователь вводит текст
  }
  
  // Ctrl+Z или Cmd+Z (на Mac)
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault(); // Предотвращаем стандартное поведение браузера
    undoHistory();
  }
});

// Инициализация: сохраняем начальное пустое состояние холста
// Это нужно вызвать после полной инициализации холста
function initHistory() {
  // Сохраняем начальное состояние (пустой холст)
  setTimeout(() => {
    saveHistoryState();
    console.log('История инициализирована');
  }, 100); // Небольшая задержка, чтобы холст точно был готов
}

// Делаем функции доступными глобально
window.saveHistoryState = saveHistoryState;
window.undoHistory = undoHistory;
window.initHistory = initHistory;

