// ========================================
// МОДУЛЬ: PERSPECTIVE (Перспективная трансформация)
// Отвечает за режим "Транспортировка" с якорями
// ========================================

// Глобальные переменные состояния
window.activePerspectiveGroup = null;
window.perspectiveMode = false;

const btnTransform = document.getElementById('btnTransform');

// Переключение режима перспективы
function togglePerspectiveMode() {
  window.perspectiveMode = !window.perspectiveMode;
  
  console.log('Переключение режима транспортировки:', window.perspectiveMode);
  
  // Отключаем ластик при включении режима транспортировки
  if (window.perspectiveMode && window.eraserMode) {
    setEraserMode(false);
  }
  
  // Обновляем состояние кнопки
  if (btnTransform) {
    if (window.perspectiveMode) {
      btnTransform.classList.add('active');
      btnTransform.style.backgroundColor = '#4A90E2';
      btnTransform.style.color = 'white';
    } else {
      btnTransform.classList.remove('active');
      btnTransform.style.backgroundColor = '';
      btnTransform.style.color = '';
    }
  }
  
  if (window.perspectiveMode) {
    // ВКЛЮЧАЕМ режим транспортировки
    const transformerNodes = window.canvasTransformer.nodes();
    let selectedGroup = null;
    
    // Находим выбранное изображение
    if (transformerNodes && transformerNodes.length > 0) {
      selectedGroup = transformerNodes[0];
    } else {
      // Ищем через getImageGroups
      const allGroups = getImageGroups();
      selectedGroup = allGroups.find(g => g.hasName('selected'));
    }
    
    // Убираем стандартный трансформер
    window.canvasTransformer.nodes([]);
    
    // Обновляем все изображения - прячем перспективу
    getImageGroups().forEach(g => {
      if (g.normalImage) g.normalImage.visible(true);
      if (g.perspectiveShape) g.perspectiveShape.visible(false);
      if (g.anchors) {
        g.anchors.forEach(a => a.visible(false));
      }
    });
    
    // Если было выбранное изображение - показываем для него якоря
    if (selectedGroup && selectedGroup.hasName('image-item')) {
      console.log('Показываем якоря для группы:', selectedGroup);
      showPerspectiveControls(selectedGroup);
    } else {
      console.log('Выбранное изображение не найдено');
    }
  } else {
    // ВЫКЛЮЧАЕМ режим транспортировки
    const previousActive = window.activePerspectiveGroup;
    
    // Прячем все якоря
    getImageGroups().forEach(g => {
      if (g.anchors) {
        g.anchors.forEach(a => a.visible(false));
      }
      if (g.normalImage) g.normalImage.visible(true);
      if (g.perspectiveShape) g.perspectiveShape.visible(false);
      if (g.updateMode) g.updateMode();
    });
    
    window.activePerspectiveGroup = null;
    
    // Если было активное изображение - выбираем его в обычном режиме
    if (previousActive && previousActive.hasName('image-item')) {
      window.canvasTransformer.nodes([previousActive]);
      previousActive.addName('selected');
    }
  }
  
  window.canvasLayer.draw();
  updateModeIndicator();
  updateLayersList();
}

// Обновление индикатора режима
function updateModeIndicator() {
  const indicator = document.getElementById('mode-indicator');
  if (indicator) {
    if (window.perspectiveMode) {
      indicator.textContent = 'Режим транспортировки';
      indicator.style.color = '#4A90E2';
    } else if (window.eraserMode) {
      indicator.textContent = 'Режим ластика';
      indicator.style.color = '#EF4444';
    } else {
      indicator.textContent = 'Обычный режим';
      indicator.style.color = '#6B7280';
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

// Показать элементы управления перспективой
function showPerspectiveControls(group) {
  console.log('showPerspectiveControls вызвана для группы:', group);
  
  if (!group) {
    console.warn('Группа не передана');
    return;
  }
  
  if (!group.anchors || !Array.isArray(group.anchors) || group.anchors.length === 0) {
    console.warn('Группа не имеет якорей:', group);
    return;
  }
  
  if (!window.perspectiveMode) {
    console.warn('Режим транспортировки не включен');
    return;
  }
  
  window.activePerspectiveGroup = group;
  
  // Показываем якоря
  group.anchors.forEach((anchor, index) => {
    if (anchor) {
      anchor.visible(true);
      anchor.moveToTop();
      console.log(`Якорь ${index} показан:`, anchor.x(), anchor.y());
    }
  });
  
  // Переключаем видимость изображений
  if (group.normalImage) {
    group.normalImage.visible(false);
    console.log('Обычное изображение скрыто');
  }
  if (group.perspectiveShape) {
    group.perspectiveShape.visible(true);
    console.log('Перспективная форма показана');
  }
  
  if (group.updateMode) {
    group.updateMode();
  }
  
  console.log('Якоря показаны, активная группа:', window.activePerspectiveGroup);
  
  window.canvasLayer.draw();
  updateLayersList();
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
  
  // Возвращаем обычное изображение
  if (group.normalImage) {
    group.normalImage.visible(true);
  }
  if (group.perspectiveShape) {
    group.perspectiveShape.visible(false);
  }
  
  if (window.activePerspectiveGroup === group) {
    window.activePerspectiveGroup = null;
  }
  
  if (group.updateMode) {
    group.updateMode();
  }
  
  window.canvasLayer.draw();
  updateLayersList();
}

// Создание изображения с поддержкой обоих режимов
function createImage(img, x, y, width, height, name) {
  const group = new Konva.Group({
    x: x,
    y: y,
    draggable: true,
    name: 'image-item',
  });
  const displayName = name || 'Слой';
  group.setAttr('displayName', displayName);
  group.setAttr('isImageItem', true);
  
  // Исходные координаты углов для перспективы
  const corners = [
    { x: 0, y: 0 },                    // topLeft
    { x: width, y: 0 },                // topRight
    { x: 0, y: height },               // bottomLeft
    { x: width, y: height }            // bottomRight
  ];
  
  // Сохраняем исходное изображение (используем то же самое)
  // img уже загружен, просто сохраняем ссылку
  
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
      // В Konva context - это Konva.Context, получаем реальный canvas context
      // В Konva v9 используем _context для доступа к реальному canvas context
      const ctx = context._context || context;
      
      const cornersLocal = corners.map(c => ({
        x: c.x,
        y: c.y
      }));
      // Используем сохранённое изображение
      const imgToUse = group.originalImage || img;
      if (imgToUse && imgToUse.complete && ctx && ctx.drawImage) {
        try {
          perspectiveTransform(ctx, imgToUse, cornersLocal);
        } catch (error) {
          console.warn('Ошибка при рисовании перспективы:', error);
        }
      }
    },
    fill: 'transparent',
    listening: true,
    visible: false,
    name: 'perspective-image',
  });
  
  group.add(normalImage);
  group.add(perspectiveShape);
  
  // Функция переключения между режимами
  function updateMode() {
    if (window.perspectiveMode && window.activePerspectiveGroup === group) {
      // Показываем перспективу только для активной группы
      normalImage.visible(false);
      perspectiveShape.visible(true);
    } else {
      // Для всех остальных - обычное изображение
      normalImage.visible(true);
      perspectiveShape.visible(false);
    }
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
      window.canvasLayer.draw();
    });
    
    anchors.push(anchor);
    group.add(anchor);
  });
  
  // Обработчик клика на изображение
  function handleImageClick(e) {
    if (window.eraserMode) {
      startEraser(e);
      return;
    }
    
    // НЕ блокируем всплытие - чтобы работало перетаскивание
    // e.cancelBubble = true; <-- УБРАЛИ
    
    if (window.perspectiveMode) {
      if (window.activePerspectiveGroup && window.activePerspectiveGroup !== group) {
        hidePerspectiveControls(window.activePerspectiveGroup);
      }
      showPerspectiveControls(group);
    } else {
      if (window.activePerspectiveGroup) {
        hidePerspectiveControls(window.activePerspectiveGroup);
      }
      
      getImageGroups().forEach(g => {
        if (g !== group && g.hasName('selected')) {
          g.removeName('selected');
        }
      });
      window.canvasTransformer.nodes([group]);
      group.addName('selected');
    }
    window.canvasLayer.draw();
    updateLayersList();
  }
  
  normalImage.on('click', handleImageClick);
  perspectiveShape.on('click', handleImageClick);
  
  // Делаем группу всегда перетаскиваемой (в обоих режимах)
  group.on('dragstart', () => {
    // В режиме транспортировки прячем якоря во время перетаскивания
    if (window.perspectiveMode && window.activePerspectiveGroup === group) {
      group.anchors.forEach(a => a.visible(false));
    }
  });
  
  group.on('dragend', () => {
    // После перетаскивания показываем якоря обратно
    if (window.perspectiveMode && window.activePerspectiveGroup === group) {
      group.anchors.forEach(a => a.visible(true));
    }
    updateLayersList();
  });
  
  // Сохраняем ссылки в группе
  group.corners = corners;
  group.anchors = anchors;
  group.normalImage = normalImage;
  group.perspectiveShape = perspectiveShape;
  group.updateMode = updateMode;
  group.originalImage = img; // Сохраняем исходное изображение для перспективы
  
  updateMode();
  
  return group;
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
    const initialX = window.canvasStage.width() / 2 - initialWidth / 2;
    const initialY = window.canvasStage.height() / 2 - initialHeight / 2;
    
    const imageGroup = createImage(
      img,
      initialX,
      initialY,
      initialWidth,
      initialHeight,
      name || 'item'
    );
    
    window.canvasLayer.add(imageGroup);
    
    // Выбираем добавленное изображение
    if (window.perspectiveMode) {
      // В режиме транспортировки - показываем якоря
      if (window.activePerspectiveGroup && window.activePerspectiveGroup !== imageGroup) {
        hidePerspectiveControls(window.activePerspectiveGroup);
      }
      showPerspectiveControls(imageGroup);
    } else {
      // В обычном режиме - применяем трансформер
      getImageGroups().forEach(g => {
        if (g.hasName('selected')) {
          g.removeName('selected');
        }
      });
      window.canvasTransformer.nodes([imageGroup]);
      imageGroup.addName('selected');
    }
    
    window.canvasLayer.draw();
    updateLayersList();
    console.log('[addImageToCanvas] drawn and selected');
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

// Горячая клавиша Ctrl+T
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 't') {
    e.preventDefault();
    togglePerspectiveMode();
    return;
  }
  
  // Отключение ластика при нажатии Escape
  if (e.key === 'Escape' && window.eraserMode) {
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

// Удаление выбранного элемента
function deleteSelected() {
  if (window.perspectiveMode && window.activePerspectiveGroup) {
    window.activePerspectiveGroup.destroy();
    window.activePerspectiveGroup = null;
    window.canvasLayer.draw();
  } else {
    const nodes = window.canvasTransformer.nodes();
    if (nodes && nodes.length > 0) {
      nodes.forEach(n => {
        n.destroy();
      });
      window.canvasTransformer.nodes([]);
      window.canvasLayer.draw();
    }
  }
  updateLayersList();
}


