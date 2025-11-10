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
  // В режиме ластика обрабатываем клики везде
  if (window.eraserMode) {
    startEraser(e);
    return;
  }
  
  // Если кликнули на пустое место (не на изображение)
  if (e.target === stage) {
    if (window.perspectiveMode && window.activePerspectiveGroup) {
      hidePerspectiveControls(window.activePerspectiveGroup);
    } else if (!window.perspectiveMode) {
      transformer.nodes([]);
      // Убираем выделение со всех элементов
      getImageGroups().forEach(group => {
        if (group.hasName('selected')) {
          group.removeName('selected');
        }
      });
    }
    layer.draw();
    updateLayersList();
  }
});

stage.on('mousemove', (e) => {
  if (window.eraserMode && window.isEraserDrawing) {
    continueEraser(e);
  }
});

stage.on('mouseup', (e) => {
  if (window.eraserMode && window.isEraserDrawing) {
    stopEraser();
  }
});

