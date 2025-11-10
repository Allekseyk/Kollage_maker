// ========================================
// МОДУЛЬ: ERASER (Ластик)
// Отвечает за инструмент стирания изображений
// ========================================

// Глобальные переменные ластика
window.eraserMode = false;
window.isEraserDrawing = false;
window.eraserLayer = null;
let eraserSize = 30;

const btnEraser = document.getElementById('btnEraser');
const eraserControls = document.getElementById('eraserControls');
const eraserSizeInput = document.getElementById('eraserSize');
const eraserSizeValue = document.getElementById('eraserSizeValue');

// Создаем слой для ластика (маска)
function initEraserLayer() {
  if (!window.eraserLayer) {
    window.eraserLayer = new Konva.Layer();
    window.canvasStage.add(window.eraserLayer);
  }
  return window.eraserLayer;
}

// Установка режима ластика
function setEraserMode(enabled) {
  window.eraserMode = enabled;
  
  // Отключаем режим транспортировки при включении ластика
  if (enabled && window.perspectiveMode) {
    window.perspectiveMode = false;
    if (window.activePerspectiveGroup) {
      hidePerspectiveControls(window.activePerspectiveGroup);
    }
    const btnTransform = document.getElementById('btnTransform');
    if (btnTransform) {
      btnTransform.classList.remove('active');
    }
  }
  
  if (btnEraser) {
    if (enabled) {
      btnEraser.classList.add('active');
      window.canvasStage.container().style.cursor = 'crosshair';
      window.canvasTransformer.nodes([]);
      initEraserLayer();
      // Показываем регулятор радиуса
      if (eraserControls) {
        eraserControls.style.display = 'flex';
      }
    } else {
      btnEraser.classList.remove('active');
      window.canvasStage.container().style.cursor = 'default';
      // Скрываем регулятор радиуса
      if (eraserControls) {
        eraserControls.style.display = 'none';
      }
    }
  }
  
  updateModeIndicator();
  window.canvasLayer.draw();
}

// Начало стирания
function startEraser(e) {
  if (!window.eraserMode) return;
  window.isEraserDrawing = true;
  const pos = window.canvasStage.getPointerPosition();
  applyEraserImproved(pos.x, pos.y);
}

// Продолжение стирания
function continueEraser(e) {
  if (!window.isEraserDrawing) return;
  const pos = window.canvasStage.getPointerPosition();
  applyEraserImproved(pos.x, pos.y);
}

// Остановка стирания
function stopEraser() {
  window.isEraserDrawing = false;
}

// Улучшенная версия ластика с реальным стиранием
function applyEraserImproved(x, y) {
  const pos = window.canvasStage.getPointerPosition();
  if (!pos) return;
  
  // Находим все изображения
  const allGroups = getImageGroups();
  
  // Проверяем каждую группу
  allGroups.forEach(group => {
    if (!group || !group.hasName('image-item')) return;
    
    const imageNode = group.findOne('.normal-image');
    if (!imageNode) return;
    
    // Проверяем, попадает ли курсор на изображение
    const absPos = imageNode.getAbsolutePosition();
    const transform = imageNode.getAbsoluteTransform();
    
    // Преобразуем координаты мыши в координаты изображения
    const invertedTransform = transform.copy().invert();
    const imagePoint = invertedTransform.point(pos);
    
    // Проверяем, находится ли точка внутри изображения
    if (imagePoint.x >= 0 && imagePoint.x <= imageNode.width() &&
        imagePoint.y >= 0 && imagePoint.y <= imageNode.height()) {
      
      const img = imageNode.image();
      if (!img || !img.complete) return;
      
      try {
        // Создаем canvas для редактирования
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        // Рисуем текущее изображение
        ctx.drawImage(img, 0, 0);
        
        // Преобразуем координаты в пиксели изображения
        const scaleX = img.width / imageNode.width();
        const scaleY = img.height / imageNode.height();
        
        const imgX = imagePoint.x * scaleX;
        const imgY = imagePoint.y * scaleY;
        
        // Проверяем границы
        if (imgX >= 0 && imgX < img.width && imgY >= 0 && imgY < img.height) {
          // Применяем ластик
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          
          // Вычисляем радиус с учетом масштаба изображения
          const avgScale = (scaleX + scaleY) / 2;
          const radius = eraserSize * avgScale;
          
          ctx.arc(imgX, imgY, Math.max(5, radius), 0, Math.PI * 2);
          ctx.fill();
          
          // Обновляем изображение
          const newImg = new Image();
          newImg.crossOrigin = 'anonymous';
          newImg.onload = () => {
            imageNode.image(newImg);
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
        }
      } catch (error) {
        console.warn('Ошибка при применении ластика:', error);
      }
    }
  });
}

// Обработчик кнопки ластика
if (btnEraser) {
  btnEraser.addEventListener('click', () => {
    setEraserMode(!window.eraserMode);
  });
}

// Обработчик регулятора радиуса ластика
if (eraserSizeInput) {
  eraserSizeInput.addEventListener('input', (e) => {
    eraserSize = parseInt(e.target.value);
    if (eraserSizeValue) {
      eraserSizeValue.textContent = eraserSize + 'px';
    }
  });
}

