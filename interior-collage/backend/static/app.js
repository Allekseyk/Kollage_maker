const API = {
  products: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`/api/products?${q}`).then(r => r.json());
  },
  categories: () => fetch(`/api/categories`).then(r => r.json()),
};

const searchEl = document.getElementById('search');
const categoryEl = document.getElementById('category');
const productsEl = document.getElementById('products');

const stageContainer = document.getElementById('stage-container');
const btnClear = document.getElementById('btnClear');
const btnExport = document.getElementById('btnExport');
const btnDelete = document.getElementById('btnDelete');
const btnEraser = document.getElementById('btnEraser'); // Переименованная кнопка
const btnTransform = document.getElementById('btnTransform'); // Новая кнопка

const width = () => stageContainer.clientWidth;
const height = () => stageContainer.clientHeight;

// Инициализация Konva
const stage = new Konva.Stage({
  container: 'stage-container',
  width: width(),
  height: height(),
});
const layer = new Konva.Layer();
stage.add(layer);

// Состояние приложения
let activePerspectiveGroup = null;
let perspectiveMode = false; // Режим перспективной трансформации
let eraserMode = false; // Режим ластика
let isEraserDrawing = false;
let eraserLayer = null; // Отдельный слой для маски ластика

// Трансформер для обычного режима
const transformer = new Konva.Transformer({
  rotateEnabled: true,
  enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top-center', 'bottom-center', 'middle-left', 'middle-right'],
});
layer.add(transformer);

// Создаем слой для ластика (маска)
function initEraserLayer() {
  if (!eraserLayer) {
    eraserLayer = new Konva.Layer();
    stage.add(eraserLayer);
  }
  return eraserLayer;
}

// Ресайз
window.addEventListener('resize', () => {
  stage.size({ width: width(), height: height() });
});

// Переключение режима перспективы (можно оставить Ctrl+T как дополнительный способ)
window.addEventListener('keydown', (e) => {
  // Ctrl+T или Cmd+T (Mac) - оставляем как дополнительный способ
  if ((e.ctrlKey || e.metaKey) && e.key === 't') {
    e.preventDefault();
    togglePerspectiveMode();
    return;
  }
  
  // Отключение ластика при нажатии Escape
  if (e.key === 'Escape' && eraserMode) {
    setEraserMode(false);
    return;
  }
  
  // Удаление по клавишам Delete / Backspace
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag.toLowerCase() === 'input' || tag.toLowerCase() === 'textarea') return;
    deleteSelected();
  }
});

// Переключение режима перспективы
function togglePerspectiveMode() {
  perspectiveMode = !perspectiveMode;
  
  console.log('Переключение режима транспортировки:', perspectiveMode); // Для отладки
  
  // Отключаем ластик при включении режима транспортировки
  if (perspectiveMode && eraserMode) {
    setEraserMode(false);
  }
  
  // Обновляем состояние кнопки
  if (btnTransform) {
    if (perspectiveMode) {
      btnTransform.classList.add('active');
      btnTransform.style.backgroundColor = '#4A90E2';
      btnTransform.style.color = 'white';
    } else {
      btnTransform.classList.remove('active');
      btnTransform.style.backgroundColor = '';
      btnTransform.style.color = '';
    }
  }
  
  // Скрываем стандартный трансформер
  if (perspectiveMode) {
    // Получаем текущее выделенное изображение (из трансформера или по имени)
    const transformerNodes = transformer.nodes();
    let selectedGroup = null;
    
    if (transformerNodes && transformerNodes.length > 0) {
      selectedGroup = transformerNodes[0];
    } else {
      // Ищем по имени 'selected'
      selectedGroup = layer.findOne(node => node.hasName('selected'));
    }
    
    // Скрываем стандартный трансформер
    transformer.nodes([]);
    
    // Если есть выделенное изображение, показываем для него якоря перспективы
    if (selectedGroup && selectedGroup.hasName('image-item')) {
      // Убираем выделение со всех других элементов
      layer.find('Group').forEach(g => {
        if (g !== selectedGroup && g.hasName('selected')) {
          g.removeName('selected');
        }
        if (g !== selectedGroup && activePerspectiveGroup === g) {
          hidePerspectiveControls(g);
        }
      });
      showPerspectiveControls(selectedGroup);
    } else if (activePerspectiveGroup) {
      // Если нет выделенного, но есть активная группа - показываем её
      showPerspectiveControls(activePerspectiveGroup);
    }
  } else {
    // Режим транспортировки выключен
    // Скрываем углы перспективы
    if (activePerspectiveGroup) {
      hidePerspectiveControls(activePerspectiveGroup);
      activePerspectiveGroup = null;
    }
    
    // Если есть активная группа перспективы, показываем для неё стандартный трансформер
    const previousPerspectiveGroup = layer.find('Group').find(g => g.hasName('image-item') && g.anchors);
    if (previousPerspectiveGroup) {
      transformer.nodes([previousPerspectiveGroup]);
      previousPerspectiveGroup.addName('selected');
    }
  }
  
  // Обновляем режим всех существующих изображений (видимость normal/perspective)
  layer.find('Group').forEach(group => {
    if (group.hasName('image-item') && group.updateMode) {
      group.updateMode();
    }
  });
  
  layer.draw();
  updateModeIndicator();
}

// Обновление индикатора режима
function updateModeIndicator() {
  const indicator = document.getElementById('mode-indicator');
  if (indicator) {
    if (perspectiveMode) {
      indicator.textContent = 'Режим транспортировки';
      indicator.style.color = '#4A90E2';
    } else if (eraserMode) {
      indicator.textContent = 'Режим ластика';
      indicator.style.color = '#EF4444';
    } else {
      indicator.textContent = 'Обычный режим';
      indicator.style.color = '#6B7280';
    }
  }
}

// Снятие выделения по клику в пустоту
stage.on('mousedown', (e) => {
  if (eraserMode) {
    // В режиме ластика обрабатываем клики везде
    startEraser(e);
    return;
  }
  
  if (e.target === stage) {
    if (perspectiveMode && activePerspectiveGroup) {
      hidePerspectiveControls(activePerspectiveGroup);
    } else if (!perspectiveMode) {
      transformer.nodes([]);
      // Убираем выделение со всех элементов
      layer.find('Group').forEach(group => {
        if (group.hasName('selected')) {
          group.removeName('selected');
        }
      });
    }
    layer.draw();
  }
});

stage.on('mousemove', (e) => {
  if (eraserMode && isEraserDrawing) {
    continueEraser(e);
  }
});

stage.on('mouseup', (e) => {
  if (eraserMode && isEraserDrawing) {
    stopEraser();
  }
});

// Удаление выбранного элемента
function deleteSelected() {
  if (perspectiveMode && activePerspectiveGroup) {
    activePerspectiveGroup.destroy();
    activePerspectiveGroup = null;
    layer.draw();
  } else {
    const nodes = transformer.nodes();
    if (nodes && nodes.length > 0) {
      nodes.forEach(n => {
        n.destroy();
      });
      transformer.nodes([]);
      layer.draw();
    }
  }
}

// Функция для перспективной трансформации через canvas
function perspectiveTransform(ctx, img, corners) {
  const width = img.width;
  const height = img.height;
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(img, 0, 0);
  
  const minX = Math.min(corners[0].x, corners[1].x, corners[2].x, corners[3].x);
  const maxX = Math.max(corners[0].x, corners[1].x, corners[2].x, corners[3].x);
  const minY = Math.min(corners[0].y, corners[1].y, corners[2].y, corners[3].y);
  const maxY = Math.max(corners[0].y, corners[1].y, corners[2].y, corners[3].y);
  
  const destWidth = maxX - minX;
  const destHeight = maxY - minY;
  
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = Math.ceil(destWidth);
  resultCanvas.height = Math.ceil(destHeight);
  const resultCtx = resultCanvas.getContext('2d');
  
  const normalizedCorners = corners.map(c => ({
    x: c.x - minX,
    y: c.y - minY
  }));
  
  const gridSize = 20;
  const cols = Math.ceil(width / gridSize);
  const rows = Math.ceil(height / gridSize);
  
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const srcX1 = col * gridSize;
      const srcY1 = row * gridSize;
      const srcX2 = Math.min((col + 1) * gridSize, width);
      const srcY2 = Math.min((row + 1) * gridSize, height);
      
      const u1 = srcX1 / width;
      const v1 = srcY1 / height;
      const u2 = srcX2 / width;
      const v2 = srcY2 / height;
      
      const topLeft = {
        x: normalizedCorners[0].x * (1 - u1) + normalizedCorners[1].x * u1,
        y: normalizedCorners[0].y * (1 - u1) + normalizedCorners[1].y * u1
      };
      const topRight = {
        x: normalizedCorners[0].x * (1 - u2) + normalizedCorners[1].x * u2,
        y: normalizedCorners[0].y * (1 - u2) + normalizedCorners[1].y * u2
      };
      const bottomLeft = {
        x: normalizedCorners[2].x * (1 - u1) + normalizedCorners[3].x * u1,
        y: normalizedCorners[2].y * (1 - u1) + normalizedCorners[3].y * u1
      };
      const bottomRight = {
        x: normalizedCorners[2].x * (1 - u2) + normalizedCorners[3].x * u2,
        y: normalizedCorners[2].y * (1 - u2) + normalizedCorners[3].y * u2
      };
      
      const destX1 = topLeft.x * (1 - v1) + bottomLeft.x * v1;
      const destY1 = topLeft.y * (1 - v1) + bottomLeft.y * v1;
      const destX2 = topRight.x * (1 - v1) + bottomRight.x * v1;
      const destY2 = topRight.y * (1 - v1) + bottomRight.y * v1;
      const destX3 = topLeft.x * (1 - v2) + bottomLeft.x * v2;
      const destY3 = topLeft.y * (1 - v2) + bottomLeft.y * v2;
      const destX4 = topRight.x * (1 - v2) + bottomRight.x * v2;
      const destY4 = topRight.y * (1 - v2) + bottomRight.y * v2;
      
      resultCtx.save();
      resultCtx.beginPath();
      resultCtx.moveTo(destX1, destY1);
      resultCtx.lineTo(destX2, destY2);
      resultCtx.lineTo(destX4, destY4);
      resultCtx.lineTo(destX3, destY3);
      resultCtx.closePath();
      resultCtx.clip();
      
      const dx = destX2 - destX1;
      const dy = destY2 - destY1;
      const dw = srcX2 - srcX1;
      const dh = srcY2 - srcY1;
      
      if (dw > 0 && dh > 0) {
        resultCtx.transform(
          dx / dw, (destY2 - destY1) / dw,
          (destX3 - destX1) / dh, dy / dh,
          destX1 - srcX1 * (dx / dw), destY1 - srcY1 * (dy / dh)
        );
        resultCtx.drawImage(tempCanvas, srcX1, srcY1, dw, dh, 0, 0, dw, dh);
      }
      resultCtx.restore();
    }
  }
  
  ctx.drawImage(resultCanvas, minX, minY);
}

// Создание изображения с поддержкой обоих режимов
function createImage(img, x, y, width, height, name) {
  const group = new Konva.Group({
    x: x,
    y: y,
    draggable: true,
    name: name || 'image-item',
  });
  
  // Исходные координаты углов для перспективы
  const corners = [
    { x: 0, y: 0 },                    // topLeft
    { x: width, y: 0 },                // topRight
    { x: 0, y: height },               // bottomLeft
    { x: width, y: height }            // bottomRight
  ];
  
  // Сохраняем исходное изображение для перспективной трансформации
  const originalImage = new Image();
  originalImage.crossOrigin = 'anonymous';
  originalImage.src = img.src || img;
  
  // Обычное изображение для стандартного режима
  const normalImage = new Konva.Image({
    image: img,
    width: width,
    height: height,
    name: 'normal-image',
  });
  
  // Кастомная форма для перспективной трансформации
  const perspectiveShape = new Konva.Shape({
    sceneFunc: function(context) {
      const ctx = context.getContext();
      const cornersAbsolute = corners.map(c => ({
        x: c.x + group.x(),
        y: c.y + group.y()
      }));
      // Используем сохраненное изображение или текущее из normalImage
      const imgToUse = group.originalImage || img;
      perspectiveTransform(ctx, imgToUse, cornersAbsolute);
    },
    fill: 'transparent',
    listening: true,
    visible: false, // По умолчанию скрыто
    name: 'perspective-image',
  });
  
  group.add(normalImage);
  group.add(perspectiveShape);
  
  // Функция переключения между режимами
  function updateMode() {
    if (perspectiveMode) {
      normalImage.visible(false);
      perspectiveShape.visible(true);
    } else {
      normalImage.visible(true);
      perspectiveShape.visible(false);
    }
    layer.draw();
  }
  
  // Создаем 4 точки для управления углами перспективы
  const anchorSize = 12;
  const anchors = [];
  const anchorNames = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
  
  anchorNames.forEach((name, index) => {
    const anchor = new Konva.Circle({
      x: corners[index].x,
      y: corners[index].y,
      radius: anchorSize,
      fill: '#4A90E2',
      stroke: '#fff',
      strokeWidth: 3,
      draggable: true,
      name: `anchor-${name}`,
      visible: false,
    });
    
    anchor.on('dragmove', function() {
      corners[index].x = this.x();
      corners[index].y = this.y();
      layer.draw();
    });
    
    anchors.push(anchor);
    group.add(anchor);
  });
  
  // Обработчик клика на изображение
  function handleImageClick(e) {
    if (eraserMode) {
      // В режиме ластика начинаем стирание при клике на изображение
      startEraser(e);
      return;
    }
    
    e.cancelBubble = true;
    
    if (perspectiveMode) {
      // Режим транспортировки: показываем якоря перспективы
      if (activePerspectiveGroup && activePerspectiveGroup !== group) {
        hidePerspectiveControls(activePerspectiveGroup);
      }
      showPerspectiveControls(group);
    } else {
      // Обычный режим - используем стандартный трансформер
      // Скрываем якоря перспективы, если они были показаны
      if (activePerspectiveGroup) {
        hidePerspectiveControls(activePerspectiveGroup);
      }
      
      // Убираем выделение с других элементов
      layer.find('Group').forEach(g => {
        if (g !== group && g.hasName('selected')) {
          g.removeName('selected');
        }
      });
      transformer.nodes([group]);
      group.addName('selected');
    }
    layer.draw();
  }
  
  normalImage.on('mousedown', handleImageClick);
  perspectiveShape.on('mousedown', handleImageClick);
  
  // Сохраняем ссылки в группе
  group.corners = corners;
  group.anchors = anchors;
  group.normalImage = normalImage;
  group.perspectiveShape = perspectiveShape;
  group.updateMode = updateMode;
  group.originalImage = img; // Сохраняем исходное изображение
  
  // Инициализируем режим
  updateMode();
  
  return group;
}

// Показать элементы управления перспективой
function showPerspectiveControls(group) {
  console.log('showPerspectiveControls вызвана для группы:', group); // Для отладки
  
  if (!group || !group.anchors) {
    console.warn('Группа не имеет якорей');
    return;
  }
  
  // Убеждаемся, что режим транспортировки включен
  if (!perspectiveMode) {
    console.warn('Режим транспортировки не включен');
    return;
  }
  
  // Показываем якоря
  group.anchors.forEach(anchor => {
    anchor.visible(true);
    anchor.moveToTop(); // Поднимаем якоря наверх, чтобы их было видно
  });
  
  // Переключаем видимость изображений
  if (group.perspectiveShape) {
    group.perspectiveShape.visible(true);
  }
  if (group.normalImage) {
    group.normalImage.visible(false);
  }
  
  // Обновляем режим группы
  if (group.updateMode) {
    group.updateMode();
  }
  
  activePerspectiveGroup = group;
  
  console.log('Якоря показаны, активная группа:', activePerspectiveGroup); // Для отладки
  
  layer.draw();
}

// Скрыть элементы управления перспективой
function hidePerspectiveControls(group) {
  if (!group || !group.anchors) {
    return;
  }
  
  // Скрываем якоря
  group.anchors.forEach(anchor => {
    anchor.visible(false);
  });
  
  // Если группа была активной, очищаем ссылку
  if (activePerspectiveGroup === group) {
    activePerspectiveGroup = null;
  }
  
  layer.draw();
}

// Функция добавления изображения на canvas
function addImageToCanvas(url, name) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  console.log('[addImageToCanvas] start', { url, name });
  
  img.onload = () => {
    console.log('[addImageToCanvas] loaded', { w: img.width, h: img.height });
    
    const initialScale = 0.4;
    const initialWidth = img.width * initialScale;
    const initialHeight = img.height * initialScale;
    const initialX = stage.width() / 2 - initialWidth / 2;
    const initialY = stage.height() / 2 - initialHeight / 2;
    
    const imageGroup = createImage(
      img,
      initialX,
      initialY,
      initialWidth,
      initialHeight,
      name || 'item'
    );
    
    layer.add(imageGroup);
    
    // В зависимости от режима показываем соответствующие элементы управления
    if (perspectiveMode) {
      showPerspectiveControls(imageGroup);
    } else {
      transformer.nodes([imageGroup]);
    }
    
    layer.draw();
    console.log('[addImageToCanvas] drawn');
  };
  
  img.onerror = () => {
    console.warn('Не удалось загрузить изображение:', url);
  };
  
  if (url.startsWith('/api/')) {
    img.src = url;
  } else {
    img.src = `/api/proxy?url=${encodeURIComponent(url)}`;
  }
}

// ========== ИНСТРУМЕНТ ЛАСТИКА ==========

// Размер ластика
let eraserSize = 30;

// Установка режима ластика
function setEraserMode(enabled) {
  eraserMode = enabled;
  
  // Отключаем режим транспортировки при включении ластика
  if (enabled && perspectiveMode) {
    perspectiveMode = false;
    if (activePerspectiveGroup) {
      hidePerspectiveControls(activePerspectiveGroup);
    }
    if (btnTransform) {
      btnTransform.classList.remove('active');
    }
  }
  
  if (btnEraser) {
    if (enabled) {
      btnEraser.classList.add('active');
      stage.container().style.cursor = 'crosshair';
      transformer.nodes([]);
      initEraserLayer();
    } else {
      btnEraser.classList.remove('active');
      stage.container().style.cursor = 'default';
    }
  }
  
  updateModeIndicator();
  layer.draw();
}

// Начало стирания
function startEraser(e) {
  if (!eraserMode) return;
  isEraserDrawing = true;
  const pos = stage.getPointerPosition();
  applyEraserImproved(pos.x, pos.y);
}

// Продолжение стирания
function continueEraser(e) {
  if (!isEraserDrawing) return;
  const pos = stage.getPointerPosition();
  applyEraserImproved(pos.x, pos.y);
}

// Остановка стирания
function stopEraser() {
  isEraserDrawing = false;
}

// Применение маски ластика к изображениям
function applyEraserMask(x, y) {
  // Проходим по всем группам с изображениями
  layer.find('Group').forEach(group => {
    if (group.hasName('image-item')) {
      // Проверяем, попадает ли точка в границы изображения
      const imageNode = group.findOne('.normal-image') || group.findOne('.perspective-image');
      if (!imageNode) return;
      
      // Получаем границы изображения
      const box = imageNode.getClientRect();
      const groupPos = group.getAbsolutePosition();
      
      // Преобразуем координаты в локальные координаты группы
      const localX = x - groupPos.x;
      const localY = y - groupPos.y;
      
      // Проверяем попадание в границы
      if (localX >= 0 && localX <= box.width && localY >= 0 && localY <= box.height) {
        // Создаем canvas для маскирования
        applyEraserToImage(group, x, y);
      }
    }
  });
}

// Применение ластика к конкретному изображению
function applyEraserToImage(group, x, y) {
  const imageNode = group.findOne('.normal-image') || group.findOne('.perspective-image');
  if (!imageNode) return;
  
  // Проверяем, что это Konva.Image
  if (imageNode.getType() !== 'Image') return;
  
  // Получаем изображение
  const image = imageNode.image();
  if (!image) return;
  
  // Создаем временный canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = image.width;
  tempCanvas.height = image.height;
  const tempCtx = tempCanvas.getContext('2d');
  
  // Рисуем исходное изображение
  tempCtx.drawImage(image, 0, 0);
  
  // Получаем позицию группы и преобразуем координаты
  const groupPos = group.getAbsolutePosition();
  const scaleX = imageNode.width() / image.width;
  const scaleY = imageNode.height() / image.height;
  
  const localX = (x - groupPos.x) / scaleX;
  const localY = (y - groupPos.y) / scaleY;
  
  // Применяем ластик
  tempCtx.globalCompositeOperation = 'destination-out';
  tempCtx.beginPath();
  tempCtx.arc(localX, localY, eraserSize / Math.max(scaleX, scaleY), 0, Math.PI * 2);
  tempCtx.fill();
  
  // Создаем новое изображение из canvas
  const newImage = new Image();
  newImage.onload = () => {
    if (imageNode.getType() === 'Image') {
      imageNode.image(newImage);
      // Обновляем исходное изображение для перспективного режима тоже
      if (group.originalImage) {
        group.originalImage = newImage;
      }
      layer.draw();
    }
  };
  newImage.src = tempCanvas.toDataURL();
}

// Упрощенная версия ластика через маску слоя
function applyEraserSimple(x, y) {
  // Создаем временный canvas для маски
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = stage.width();
  maskCanvas.height = stage.height();
  const maskCtx = maskCanvas.getContext('2d');
  
  // Рисуем черную маску
  maskCtx.fillStyle = 'black';
  maskCtx.beginPath();
  maskCtx.arc(x, y, eraserSize, 0, Math.PI * 2);
  maskCtx.fill();
  
  // Экспортируем слой как изображение
  const layerData = layer.toDataURL();
  const layerImg = new Image();
  layerImg.onload = () => {
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = stage.width();
    resultCanvas.height = stage.height();
    const resultCtx = resultCanvas.getContext('2d');
    
    // Рисуем исходный слой
    resultCtx.drawImage(layerImg, 0, 0);
    
    // Применяем маску ластика
    resultCtx.globalCompositeOperation = 'destination-out';
    resultCtx.drawImage(maskCanvas, 0, 0);
    
    // Обновляем слой (это сложно, поэтому используем другой подход)
  };
  layerImg.src = layerData;
}

// Более простой подход: рисуем белые круги поверх изображений
function applyEraserVisual(x, y) {
  // Находим все изображения под курсором
  const shapes = stage.getIntersection({ x, y });
  
  shapes.forEach(shape => {
    const group = shape.getParent();
    if (group && group.hasName('image-item')) {
      // Создаем белый круг поверх изображения для визуального эффекта
      const eraserVisual = new Konva.Circle({
        x: x,
        y: y,
        radius: eraserSize,
        fill: 'white',
        listening: false,
        name: 'eraser-mark',
      });
      
      // Добавляем в отдельный слой поверх основного
      if (!eraserLayer) {
        initEraserLayer();
      }
      eraserLayer.add(eraserVisual);
    }
  });
  
  eraserLayer.draw();
}

// Улучшенная версия ластика с реальным стиранием
function applyEraserImproved(x, y) {
  // Исправляем: используем stage для получения пересечений
  const pos = stage.getPointerPosition();
  if (!pos) return;
  
  // Находим все формы под курсором
  const shapes = stage.getIntersections(pos);
  
  if (!shapes || shapes.length === 0) return;
  
  shapes.forEach(shape => {
    // Находим родительскую группу с изображением
    let node = shape;
    let group = null;
    
    // Поднимаемся по дереву до группы с изображением
    while (node) {
      if (node.hasName && node.hasName('image-item')) {
        group = node;
        break;
      }
      node = node.getParent();
    }
    
    if (group && group.hasName('image-item')) {
      // Получаем нормальное изображение (оно видно в обычном режиме)
      const imageNode = group.findOne('.normal-image');
      if (!imageNode) return;
      
      // Проверяем, что это Konva.Image
      if (imageNode.getType() !== 'Image') return;
      
      // Получаем изображение
      const img = imageNode.image();
      if (!img || !img.complete) return;
      
      try {
        // Создаем canvas для редактирования
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        // Рисуем исходное изображение
        ctx.drawImage(img, 0, 0);
        
        // Вычисляем координаты в пространстве изображения
        const transform = imageNode.getAbsoluteTransform().copy().invert();
        const imagePoint = transform.point(pos);
        
        const scaleX = imageNode.width() / img.width;
        const scaleY = imageNode.height() / img.height;
        
        const imgX = imagePoint.x / scaleX;
        const imgY = imagePoint.y / scaleY;
        
        // Проверяем границы
        if (imgX >= 0 && imgX < img.width && imgY >= 0 && imgY < img.height) {
          // Применяем ластик
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          const radius = eraserSize / Math.max(Math.abs(scaleX), Math.abs(scaleY));
          ctx.arc(imgX, imgY, Math.max(5, radius), 0, Math.PI * 2);
          ctx.fill();
          
          // Обновляем изображение
          const newImg = new Image();
          newImg.crossOrigin = 'anonymous';
          newImg.onload = () => {
            imageNode.image(newImg);
            // Сохраняем обновленное изображение для перспективного режима
            if (group.normalImage) {
              group.normalImage.image(newImg);
            }
            // Обновляем исходное изображение, если оно используется в перспективе
            if (group.perspectiveShape) {
              // Обновляем исходное изображение для перспективной трансформации
              const perspectiveImg = group.perspectiveShape.image();
              if (perspectiveImg) {
                group.originalImage = newImg;
              }
            }
            layer.draw();
          };
          newImg.onerror = () => {
            console.warn('Ошибка загрузки обновленного изображения');
          };
          newImg.src = canvas.toDataURL();
        }
      } catch (error) {
        console.warn('Ошибка при применении ластика:', error);
      }
    }
  });
}

function renderProducts(items) {
  productsEl.innerHTML = '';
  items.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.title = p.name;

    const img = document.createElement('img');
    if (p.id) {
      img.src = `/api/image/${p.id}`;
    } else if (p.image_url) {
      img.src = `/api/proxy?url=${encodeURIComponent(p.image_url)}`;
    }
    img.alt = p.name;
    img.onerror = function() {
      if (p.image_url && this.src !== `/api/proxy?url=${encodeURIComponent(p.image_url)}`) {
        this.src = `/api/proxy?url=${encodeURIComponent(p.image_url)}`;
      } else {
        console.warn('Не удалось загрузить изображение для:', p.name);
      }
    };

    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = p.name;

    card.appendChild(img);
    card.appendChild(name);

    card.addEventListener('click', () => {
      if (eraserMode) return; // В режиме ластика не добавляем изображения
      console.log('[catalog click]', p.name);
      const imageUrl = p.id ? `/api/image/${p.id}` : p.image_url;
      addImageToCanvas(imageUrl, p.name);
    });
    productsEl.appendChild(card);
  });
}

async function initCatalog() {
  const cats = await API.categories();
  const optAll = document.createElement('option');
  optAll.value = '';
  optAll.textContent = 'Все категории';
  categoryEl.appendChild(optAll);
  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    categoryEl.appendChild(opt);
  });

  await reloadProducts();
}

async function reloadProducts() {
  const params = {};
  const s = searchEl.value.trim();
  if (s) params.search = s;
  const c = categoryEl.value;
  if (c) params.category = c;
  params.limit = 100;
  const items = await API.products(params);
  renderProducts(items);
}

searchEl.addEventListener('input', debounce(reloadProducts, 300));
categoryEl.addEventListener('change', reloadProducts);

btnClear.addEventListener('click', () => {
  layer.destroyChildren();
  if (eraserLayer) {
    eraserLayer.destroyChildren();
  }
  activePerspectiveGroup = null;
  transformer.nodes([]);
  layer.draw();
});

btnExport.addEventListener('click', () => {
  if (activePerspectiveGroup) {
    hidePerspectiveControls(activePerspectiveGroup);
  }
  transformer.nodes([]);
  layer.draw();
  const dataURL = stage.toDataURL({ pixelRatio: 2 });
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = 'collage.png';
  a.click();
});

// Обработчик кнопки транспортировки
if (btnTransform) {
  console.log('Обработчик кнопки транспортировки зарегистрирован');
  btnTransform.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Кнопка транспортировки нажата');
    togglePerspectiveMode();
  });
} else {
  console.error('Кнопка btnTransform не найдена!');
}

// Обработчик кнопки ластика
if (btnEraser) {
  btnEraser.addEventListener('click', () => {
    setEraserMode(!eraserMode);
  });
}

btnDelete.addEventListener('click', deleteSelected);

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

initCatalog();
updateModeIndicator();



