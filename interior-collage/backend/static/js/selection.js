// ========================================
// МОДУЛЬ: SELECTION (Инструмент выделения)
// Отвечает за выделение областей изображений для копирования/удаления
// ========================================

// Глобальные переменные выделения
window.selectionMode = false; // 'rect' | 'lasso' | false
window.isSelecting = false;
window.selectionLayer = null;
window.currentSelection = null; // { type: 'rect'|'lasso', points: [], targetGroup: Group }
window.clipboard = null; // Сохраненное выделение для вставки

const btnSelectionRect = document.getElementById('btnSelectionRect');
const btnSelectionLasso = document.getElementById('btnSelectionLasso');

// Создаем слой для отображения выделения
function initSelectionLayer() {
  if (!window.selectionLayer) {
    window.selectionLayer = new Konva.Layer();
    window.canvasStage.add(window.selectionLayer);
  }
  return window.selectionLayer;
}

// Установка режима выделения
function setSelectionMode(mode) {
  // Отключаем другие режимы
  if (window.eraserMode) {
    setEraserMode(false);
  }
  
  // Снимаем выделение трансформера
  window.canvasTransformer.nodes([]);
  
  // Устанавливаем новый режим
  const previousMode = window.selectionMode;
  window.selectionMode = mode;
  
  // Обновляем кнопки
  if (btnSelectionRect) {
    btnSelectionRect.classList.toggle('active', mode === 'rect');
  }
  if (btnSelectionLasso) {
    btnSelectionLasso.classList.toggle('active', mode === 'lasso');
  }
  
  // Очищаем текущее выделение при переключении режима
  if (previousMode && previousMode !== mode) {
    clearSelection();
  }
  
  // Отключаем/включаем перетаскивание групп в зависимости от режима
  const groups = getImageGroups();
  groups.forEach(group => {
    if (mode) {
      // Сохраняем исходное состояние draggable
      if (group.getAttr('wasDraggable') === undefined) {
        group.setAttr('wasDraggable', group.draggable());
      }
      // Отключаем перетаскивание в режиме выделения
      group.draggable(false);
    } else {
      // Восстанавливаем исходное состояние draggable
      const wasDraggable = group.getAttr('wasDraggable');
      if (wasDraggable !== undefined) {
        group.draggable(wasDraggable);
        group.setAttr('wasDraggable', undefined);
      } else {
        // По умолчанию группы должны быть перетаскиваемыми
        group.draggable(true);
      }
    }
  });
  
  // Устанавливаем курсор
  if (mode) {
    window.canvasStage.container().style.cursor = mode === 'rect' ? 'crosshair' : 'crosshair';
    initSelectionLayer();
  } else {
    window.canvasStage.container().style.cursor = 'default';
    clearSelection();
  }
  
  updateModeIndicator();
  window.canvasLayer.draw();
}

// Очистка выделения
function clearSelection() {
  if (window.selectionLayer) {
    window.selectionLayer.destroyChildren();
    window.selectionLayer.draw();
  }
  window.currentSelection = null;
  window.isSelecting = false;
}

// Начало выделения
function startSelection(e) {
  if (!window.selectionMode) return;
  
  // Предотвращаем перетаскивание, если кликнули на группу
  if (e.target && e.target.getParent) {
    const parent = e.target.getParent();
    if (parent && parent.hasName && parent.hasName('image-item')) {
      // Останавливаем любое возможное перетаскивание
      e.cancelBubble = true;
    }
  }
  
  // Находим группу изображения под курсором
  const pos = window.canvasStage.getPointerPosition();
  if (!pos) return;
  
  const targetGroup = findGroupAtPosition(pos.x, pos.y);
  if (!targetGroup) {
    // Если кликнули не на изображение, очищаем выделение
    clearSelection();
    return;
  }
  
  // Убеждаемся, что группа не перетаскивается
  if (targetGroup.draggable()) {
    targetGroup.draggable(false);
  }
  
  // Сохраняем состояние перед началом выделения
  if (!window.isSelecting && typeof window.saveHistoryState === 'function') {
    window.saveHistoryState();
  }
  
  window.isSelecting = true;
  window.currentSelection = {
    type: window.selectionMode,
    points: [pos],
    targetGroup: targetGroup
  };
  
  // Преобразуем координаты в координаты группы
  const groupPos = targetGroup.getAbsolutePosition();
  const groupTransform = targetGroup.getAbsoluteTransform();
  const invertedTransform = groupTransform.copy().invert();
  const localPoint = invertedTransform.point(pos);
  
  window.currentSelection.localPoints = [localPoint];
  
  // Создаем визуальное выделение
  drawSelectionVisual();
}

// Продолжение выделения
function continueSelection(e) {
  if (!window.isSelecting || !window.currentSelection) return;
  
  const pos = window.canvasStage.getPointerPosition();
  if (!pos) return;
  
  if (window.selectionMode === 'rect') {
    // Для прямоугольника обновляем только вторую точку
    if (window.currentSelection.localPoints.length === 1) {
      const groupTransform = window.currentSelection.targetGroup.getAbsoluteTransform();
      const invertedTransform = groupTransform.copy().invert();
      const localPoint = invertedTransform.point(pos);
      window.currentSelection.localPoints.push(localPoint);
    } else {
      const groupTransform = window.currentSelection.targetGroup.getAbsoluteTransform();
      const invertedTransform = groupTransform.copy().invert();
      const localPoint = invertedTransform.point(pos);
      window.currentSelection.localPoints[1] = localPoint;
    }
  } else if (window.selectionMode === 'lasso') {
    // Для лассо добавляем точки
    const groupTransform = window.currentSelection.targetGroup.getAbsoluteTransform();
    const invertedTransform = groupTransform.copy().invert();
    const localPoint = invertedTransform.point(pos);
    window.currentSelection.localPoints.push(localPoint);
  }
  
  drawSelectionVisual();
}

// Остановка выделения
function stopSelection() {
  if (!window.isSelecting) return;
  window.isSelecting = false;
  
  // Финализируем выделение
  if (window.currentSelection && window.currentSelection.localPoints.length >= 2) {
    finalizeSelection();
  } else {
    clearSelection();
  }
}

// Рисование визуального выделения
function drawSelectionVisual() {
  if (!window.currentSelection || !window.selectionLayer) return;
  
  // Очищаем предыдущее выделение
  window.selectionLayer.destroyChildren();
  
  const selection = window.currentSelection;
  const group = selection.targetGroup;
  const groupPos = group.getAbsolutePosition();
  
  if (selection.type === 'rect' && selection.localPoints.length >= 2) {
    // Рисуем прямоугольник
    const p1 = selection.localPoints[0];
    const p2 = selection.localPoints[1];
    
    const x = Math.min(p1.x, p2.x);
    const y = Math.min(p1.y, p2.y);
    const width = Math.abs(p2.x - p1.x);
    const height = Math.abs(p2.y - p1.y);
    
    const rect = new Konva.Rect({
      x: groupPos.x + x,
      y: groupPos.y + y,
      width: width,
      height: height,
      stroke: '#4A90E2',
      strokeWidth: 2,
      dash: [10, 5],
      fill: 'rgba(74, 144, 226, 0.1)',
      listening: false
    });
    
    window.selectionLayer.add(rect);
  } else if (selection.type === 'lasso' && selection.localPoints.length >= 2) {
    // Рисуем лассо
    const points = selection.localPoints.map(p => ({
      x: groupPos.x + p.x,
      y: groupPos.y + p.y
    }));
    
    const line = new Konva.Line({
      points: points.flatMap(p => [p.x, p.y]),
      stroke: '#4A90E2',
      strokeWidth: 2,
      dash: [10, 5],
      fill: 'rgba(74, 144, 226, 0.1)',
      closed: false,
      listening: false
    });
    
    window.selectionLayer.add(line);
    
    // Если точек достаточно, замыкаем контур
    if (points.length >= 3) {
      const closedPoints = [...points, points[0]];
      const closedLine = new Konva.Line({
        points: closedPoints.flatMap(p => [p.x, p.y]),
        fill: 'rgba(74, 144, 226, 0.1)',
        closed: true,
        listening: false
      });
      window.selectionLayer.add(closedLine);
      line.moveToTop();
    }
  }
  
  window.selectionLayer.draw();
}

// Финализация выделения (создание маски)
function finalizeSelection() {
  if (!window.currentSelection) return;
  
  const selection = window.currentSelection;
  const group = selection.targetGroup;
  
  // Находим изображение в группе
  const imageNode = group.findOne('.normal-image');
  if (!imageNode || !imageNode.image()) return;
  
  const img = imageNode.image();
  if (!img || !img.complete) return;
  
  // Создаем маску для выделения
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = img.width;
  maskCanvas.height = img.height;
  const maskCtx = maskCanvas.getContext('2d');
  
  // Преобразуем координаты выделения в координаты изображения
  const scaleX = img.width / imageNode.width();
  const scaleY = img.height / imageNode.height();
  
  maskCtx.fillStyle = 'black';
  maskCtx.beginPath();
  
  if (selection.type === 'rect' && selection.localPoints.length >= 2) {
    const p1 = selection.localPoints[0];
    const p2 = selection.localPoints[1];
    
    const x = Math.min(p1.x, p2.x) * scaleX;
    const y = Math.min(p1.y, p2.y) * scaleY;
    const width = Math.abs(p2.x - p1.x) * scaleX;
    const height = Math.abs(p2.y - p1.y) * scaleY;
    
    maskCtx.rect(x, y, width, height);
  } else if (selection.type === 'lasso' && selection.localPoints.length >= 3) {
    const points = selection.localPoints.map(p => ({
      x: p.x * scaleX,
      y: p.y * scaleY
    }));
    
    maskCtx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      maskCtx.lineTo(points[i].x, points[i].y);
    }
    maskCtx.closePath();
  } else {
    clearSelection();
    return;
  }
  
  maskCtx.fill();
  
  // Сохраняем данные выделения
  selection.maskCanvas = maskCanvas;
  selection.imageNode = imageNode;
  selection.group = group;
  
  // Выделение готово к использованию
  window.canvasLayer.draw();
}

// Поиск группы изображения в указанной позиции
function findGroupAtPosition(x, y) {
  const groups = getImageGroups();
  
  for (let group of groups) {
    const imageNode = group.findOne('.normal-image');
    if (!imageNode) continue;
    
    const groupPos = group.getAbsolutePosition();
    const groupTransform = group.getAbsoluteTransform();
    const invertedTransform = groupTransform.copy().invert();
    const localPoint = invertedTransform.point({ x, y });
    
    // Проверяем, находится ли точка внутри изображения
    if (localPoint.x >= 0 && localPoint.x <= imageNode.width() &&
        localPoint.y >= 0 && localPoint.y <= imageNode.height()) {
      return group;
    }
  }
  
  return null;
}

// Копирование выделенной области
function copySelection() {
  if (!window.currentSelection || !window.currentSelection.maskCanvas) {
    return;
  }
  
  const selection = window.currentSelection;
  const imageNode = selection.imageNode;
  const img = imageNode.image();
  
  if (!img || !img.complete) return;
  
  // Создаем canvas для копирования
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  
  // Рисуем исходное изображение
  ctx.drawImage(img, 0, 0);
  
  // Применяем маску
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(selection.maskCanvas, 0, 0);
  
  // Находим границы выделения
  const maskData = selection.maskCanvas.getContext('2d').getImageData(0, 0, selection.maskCanvas.width, selection.maskCanvas.height);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hasPixels = false;
  
  for (let y = 0; y < maskData.height; y++) {
    for (let x = 0; x < maskData.width; x++) {
      const idx = (y * maskData.width + x) * 4;
      if (maskData.data[idx + 3] > 0) {
        hasPixels = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  if (!hasPixels) return;
  
  // Обрезаем canvas до размеров выделения
  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedCtx = croppedCanvas.getContext('2d');
  
  croppedCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  
  // Сохраняем в буфер обмена
  const newImg = new Image();
  newImg.crossOrigin = 'anonymous';
  newImg.onload = () => {
    window.clipboard = {
      image: newImg,
      width: cropWidth,
      height: cropHeight
    };
    console.log('Выделение скопировано в буфер обмена');
  };
  newImg.src = croppedCanvas.toDataURL('image/png');
}

// Вставка выделенной области
function pasteSelection() {
  if (!window.clipboard || !window.clipboard.image) {
    return;
  }
  
  // Сохраняем состояние перед вставкой
  if (typeof window.saveHistoryState === 'function') {
    window.saveHistoryState();
  }
  
  const img = window.clipboard.image;
  const width = window.clipboard.width;
  const height = window.clipboard.height;
  
  // Масштабируем для отображения на холсте
  const scale = Math.min(400 / width, 400 / height, 1);
  const displayWidth = width * scale;
  const displayHeight = height * scale;
  
  // Размещаем в центре холста
  const x = window.canvasStage.width() / 2 - displayWidth / 2;
  const y = window.canvasStage.height() / 2 - displayHeight / 2;
  
  // Создаем новую группу с изображением
  const newGroup = createImage(
    img,
    x,
    y,
    displayWidth,
    displayHeight,
    'Выделение (копия)'
  );
  
  window.canvasLayer.add(newGroup);
  window.canvasLayer.draw();
  updateLayersList();
  
  // Выбираем вставленное изображение
  getImageGroups().forEach(g => {
    if (g.hasName('selected')) {
      g.removeName('selected');
    }
  });
  window.canvasTransformer.nodes([newGroup]);
  newGroup.addName('selected');
  
  window.canvasLayer.draw();
  updateLayersList();
}

// Удаление выделенной области
function deleteSelection() {
  if (!window.currentSelection || !window.currentSelection.maskCanvas) {
    return;
  }
  
  // Сохраняем состояние перед удалением
  if (typeof window.saveHistoryState === 'function') {
    window.saveHistoryState();
  }
  
  const selection = window.currentSelection;
  const imageNode = selection.imageNode;
  const img = imageNode.image();
  
  if (!img || !img.complete) return;
  
  // Создаем canvas для редактирования
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  
  // Рисуем текущее изображение
  ctx.drawImage(img, 0, 0);
  
  // Удаляем выделенную область
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(selection.maskCanvas, 0, 0);
  
  // Обновляем изображение
  const newImg = new Image();
  newImg.crossOrigin = 'anonymous';
  newImg.onload = () => {
    imageNode.image(newImg);
    const group = selection.group;
    if (group.normalImage) {
      group.normalImage.image(newImg);
    }
    if (group.originalImage) {
      group.originalImage = newImg;
    }
    window.canvasLayer.draw();
    updateLayersList();
  };
  newImg.onerror = () => {
    console.warn('Ошибка загрузки обновленного изображения');
  };
  newImg.src = canvas.toDataURL('image/png');
  
  // Очищаем выделение
  clearSelection();
}

// Обработчики кнопок
if (btnSelectionRect) {
  btnSelectionRect.addEventListener('click', () => {
    setSelectionMode(window.selectionMode === 'rect' ? false : 'rect');
  });
}

if (btnSelectionLasso) {
  btnSelectionLasso.addEventListener('click', () => {
    setSelectionMode(window.selectionMode === 'lasso' ? false : 'lasso');
  });
}

// Обработка горячих клавиш
window.addEventListener('keydown', (e) => {
  // Ctrl+C - копировать выделение
  if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag.toLowerCase() === 'input' || tag.toLowerCase() === 'textarea') return;
    
    if (window.selectionMode && window.currentSelection && window.currentSelection.maskCanvas) {
      e.preventDefault();
      copySelection();
      return;
    }
  }
  
  // Ctrl+V - вставить выделение
  if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag.toLowerCase() === 'input' || tag.toLowerCase() === 'textarea') return;
    
    if (window.clipboard && window.clipboard.image) {
      e.preventDefault();
      pasteSelection();
      return;
    }
  }
  
  // Delete - удалить выделение
  if (e.key === 'Delete' || e.key === 'Backspace') {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag.toLowerCase() === 'input' || tag.toLowerCase() === 'textarea') return;
    
    if (window.selectionMode && window.currentSelection && window.currentSelection.maskCanvas) {
      e.preventDefault();
      deleteSelection();
      return;
    }
  }
});

// Делаем функции доступными глобально для использования в других модулях
window.startSelection = startSelection;
window.continueSelection = continueSelection;
window.stopSelection = stopSelection;
window.setSelectionMode = setSelectionMode;
window.copySelection = copySelection;
window.pasteSelection = pasteSelection;
window.deleteSelection = deleteSelection;
