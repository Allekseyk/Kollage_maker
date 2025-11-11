// ========================================
// МОДУЛЬ: 3D-ПРЕОБРАЗОВАНИЕ (PERSPECTIVE)
// Отвечает за перспективную трансформацию изображений
// ========================================

// Глобальные переменные для модального окна
window.activePerspectiveGroup = null; // Текущая выбранная группа для трансформации

// ========================================
// МАТЕМАТИЧЕСКИЕ ФУНКЦИИ ДЛЯ 3D-ТРАНСФОРМАЦИИ
// ========================================

// Преобразует градусы в радианы
function toRadians(degrees) {
  return degrees * Math.PI / 180;
}

// Матрица вращения вокруг оси X (наклон вверх/вниз)
function rotationMatrixX(angle) {
  const rad = toRadians(angle);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    [1, 0, 0],
    [0, cos, -sin],
    [0, sin, cos]
  ];
}

// Матрица вращения вокруг оси Y (поворот влево/вправо)
function rotationMatrixY(angle) {
  const rad = toRadians(angle);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    [cos, 0, sin],
    [0, 1, 0],
    [-sin, 0, cos]
  ];
}

// Матрица вращения вокруг оси Z (вращение по часовой стрелке)
function rotationMatrixZ(angle) {
  const rad = toRadians(angle);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    [cos, -sin, 0],
    [sin, cos, 0],
    [0, 0, 1]
  ];
}

// Умножение матриц 3x3
function multiplyMatrices(a, b) {
  const result = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0]
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        result[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return result;
}

// Умножение матрицы на вектор
function multiplyMatrixVector(matrix, vector) {
  return [
    matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
    matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
    matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2]
  ];
}

// Перспективная проекция (превращает 3D-координаты в 2D)
function perspectiveProjection(x, y, z, focalLength, distance) {
  // Формула перспективной проекции
  // x_proj = f * x / (z + d)
  // y_proj = f * y / (z + d)
  const factor = focalLength / (z + distance);
  return {
    x: x * factor,
    y: y * factor
  };
}

// Вычисляет матрицу перспективной трансформации из четырёх точек
// src - исходные точки (четыре угла прямоугольника)
// dst - целевые точки (четыре угла после трансформации)
// Возвращает матрицу [a, b, c, d, e, f] для setTransform
function getPerspectiveMatrix(src, dst) {
  // Используем упрощённый алгоритм для аффинной трансформации
  // Это даёт хороший результат для небольших углов перспективы
  
  // Вычисляем коэффициенты через систему уравнений
  const x0 = src[0].x, y0 = src[0].y;
  const x1 = src[1].x, y1 = src[1].y;
  const x2 = src[2].x, y2 = src[2].y;
  const x3 = src[3].x, y3 = src[3].y;
  
  const u0 = dst[0].x, v0 = dst[0].y;
  const u1 = dst[1].x, v1 = dst[1].y;
  const u2 = dst[2].x, v2 = dst[2].y;
  const u3 = dst[3].x, v3 = dst[3].y;
  
  // Решаем систему уравнений для аффинной трансформации
  // Используем метод наименьших квадратов для более точного результата
  
  // Вычисляем матрицу через метод четырёх точек
  // Для перспективной трансформации используем гомогенные координаты
  const A = [
    [x0, y0, 1, 0, 0, 0],
    [0, 0, 0, x0, y0, 1],
    [x1, y1, 1, 0, 0, 0],
    [0, 0, 0, x1, y1, 1],
    [x2, y2, 1, 0, 0, 0],
    [0, 0, 0, x2, y2, 1]
  ];
  
  const b = [u0, v0, u1, v1, u2, v2];
  
  // Решаем систему Ax = b методом Гаусса
  const result = solveLinearSystem(A, b);
  
  if (result) {
    return [
      result[0], result[3],  // a, c
      result[1], result[4],  // b, d
      result[2], result[5]    // e, f
    ];
  }
  
  // Если решение не найдено, возвращаем единичную матрицу
  return [1, 0, 0, 1, 0, 0];
}

// Решает систему линейных уравнений методом Гаусса
function solveLinearSystem(A, b) {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);
  
  // Прямой ход метода Гаусса
  for (let i = 0; i < n; i++) {
    // Поиск максимального элемента в столбце
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    
    // Перестановка строк
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
    
    // Проверка на вырожденность
    if (Math.abs(augmented[i][i]) < 1e-10) {
      return null;
    }
    
    // Исключение
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j < n + 1; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }
  
  // Обратный ход
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    x[i] /= augmented[i][i];
  }
  
  return x;
}

// Рисует треугольник с перспективной трансформацией через пиксельную интерполяцию
// ctx - контекст canvas
// img - изображение для рисования
// src1, src2, src3 - исходные координаты трёх точек треугольника в изображении
// dst1, dst2, dst3 - целевые координаты трёх точек треугольника на холсте
function drawPerspectiveTriangle(ctx, img, src1, src2, src3, dst1, dst2, dst3) {
  // Вычисляем размеры bounding box для треугольника
  const minX = Math.min(dst1.x, dst2.x, dst3.x);
  const minY = Math.min(dst1.y, dst2.y, dst3.y);
  const maxX = Math.max(dst1.x, dst2.x, dst3.x);
  const maxY = Math.max(dst1.y, dst2.y, dst3.y);
  
  const width = Math.ceil(maxX - minX);
  const height = Math.ceil(maxY - minY);
  
  if (width <= 0 || height <= 0) return;
  
  // Создаём временный canvas для треугольника
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = width;
  tempCanvas.height = height;
  const tempCtx = tempCanvas.getContext('2d');
  
  // Смещаем координаты в начало координат временного canvas
  const d1 = { x: dst1.x - minX, y: dst1.y - minY };
  const d2 = { x: dst2.x - minX, y: dst2.y - minY };
  const d3 = { x: dst3.x - minX, y: dst3.y - minY };
  
  // Вычисляем матрицу аффинной трансформации для треугольника
  const matrix = getTriangleTransform(src1, src2, src3, d1, d2, d3);
  
  if (!matrix) return;
  
  // Создаём маску для треугольника
  tempCtx.beginPath();
  tempCtx.moveTo(d1.x, d1.y);
  tempCtx.lineTo(d2.x, d2.y);
  tempCtx.lineTo(d3.x, d3.y);
  tempCtx.closePath();
  tempCtx.clip();
  
  // Применяем трансформацию
  tempCtx.setTransform(
    matrix[0], matrix[1],
    matrix[2], matrix[3],
    matrix[4], matrix[5]
  );
  
  // Рисуем изображение на временном canvas
  tempCtx.drawImage(img, 0, 0);
  
  // Рисуем временный canvas на основном холсте
  ctx.drawImage(tempCanvas, minX, minY);
}

// Вычисляет матрицу аффинной трансформации для треугольника
function getTriangleTransform(src1, src2, src3, dst1, dst2, dst3) {
  // Решаем систему уравнений для аффинной трансформации
  // x' = a*x + b*y + c
  // y' = d*x + e*y + f
  
  const A = [
    [src1.x, src1.y, 1, 0, 0, 0],
    [0, 0, 0, src1.x, src1.y, 1],
    [src2.x, src2.y, 1, 0, 0, 0],
    [0, 0, 0, src2.x, src2.y, 1],
    [src3.x, src3.y, 1, 0, 0, 0],
    [0, 0, 0, src3.x, src3.y, 1]
  ];
  
  const b = [dst1.x, dst1.y, dst2.x, dst2.y, dst3.x, dst3.y];
  
  const result = solveLinearSystem(A, b);
  
  if (result) {
    return [
      result[0], result[3],  // a, d
      result[1], result[4],  // b, e
      result[2], result[5]    // c, f
    ];
  }
  
  return null;
}

// ========================================
// ФУНКЦИИ ДЛЯ РАБОТЫ С МОДАЛЬНЫМ ОКНОМ
// ========================================

// Открывает модальное окно 3D-преобразования
function open3DTransformModal() {
  // Проверяем, есть ли выбранное изображение
  const selectedGroups = getImageGroups().filter(g => g.hasName('selected'));
  
  if (selectedGroups.length === 0) {
    alert('Выберите изображение для 3D-преобразования');
    return;
  }
  
  if (selectedGroups.length > 1) {
    alert('Выберите только одно изображение для 3D-преобразования');
    return;
  }
  
  // Сохраняем выбранную группу
  window.activePerspectiveGroup = selectedGroups[0];
  
  // Получаем текущие значения углов (если они были сохранены)
  const currentAngles = window.activePerspectiveGroup.getAttr('perspectiveAngles') || { x: 0, y: 0, z: 0 };
  
  // Обновляем значения в полях ввода
  document.getElementById('angleX').value = currentAngles.x;
  document.getElementById('angleY').value = currentAngles.y;
  document.getElementById('angleZ').value = currentAngles.z;
  
  // Показываем модальное окно
  const modal = document.getElementById('transform3DModal');
  modal.classList.add('show');
}

// Закрывает модальное окно
function close3DTransformModal() {
  const modal = document.getElementById('transform3DModal');
  modal.classList.remove('show');
  window.activePerspectiveGroup = null;
}

// Применяет 3D-преобразование к выбранному изображению
function apply3DTransform() {
  if (!window.activePerspectiveGroup) {
    alert('Не выбрано изображение для преобразования');
    return;
  }
  
  // Получаем значения углов из полей ввода
  const angleX = parseFloat(document.getElementById('angleX').value) || 0;
  const angleY = parseFloat(document.getElementById('angleY').value) || 0;
  const angleZ = parseFloat(document.getElementById('angleZ').value) || 0;
  
  // Сохраняем состояние для истории отмены
  if (typeof window.saveHistoryState === 'function') {
    window.saveHistoryState();
  }
  
  // Сохраняем углы в атрибутах группы
  window.activePerspectiveGroup.setAttr('perspectiveAngles', { x: angleX, y: angleY, z: angleZ });
  
  // Получаем изображение из группы
  const image = window.activePerspectiveGroup.findOne('.normal-image');
  if (!image) {
    alert('Изображение не найдено в группе');
    return;
  }
  
  // Получаем размеры изображения
  const width = image.width();
  const height = image.height();
  
  // Определяем 4 угла изображения (в локальных координатах)
  const corners = [
    { x: 0, y: 0 },           // Верхний левый
    { x: width, y: 0 },       // Верхний правый
    { x: width, y: height },  // Нижний правый
    { x: 0, y: height }       // Нижний левый
  ];
  
  // Центр изображения
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Создаём комбинированную матрицу вращения
  const rx = rotationMatrixX(angleX);
  const ry = rotationMatrixY(angleY);
  const rz = rotationMatrixZ(angleZ);
  
  // Порядок применения: Z -> Y -> X
  let rotationMatrix = multiplyMatrices(rz, ry);
  rotationMatrix = multiplyMatrices(rotationMatrix, rx);
  
  // Настройки перспективы
  const focalLength = Math.max(width, height); // Фокусное расстояние "камеры"
  const distance = Math.max(width, height) * 2; // Расстояние от "камеры"
  
  // Применяем трансформацию к каждому углу
  const transformedCorners = corners.map(corner => {
    // Переносим в центр (для вращения вокруг центра)
    const x = corner.x - centerX;
    const y = corner.y - centerY;
    const z = 0; // Изначально изображение плоское (z = 0)
    
    // Применяем матрицу вращения
    const rotated = multiplyMatrixVector(rotationMatrix, [x, y, z]);
    
    // Применяем перспективную проекцию
    const projected = perspectiveProjection(rotated[0], rotated[1], rotated[2], focalLength, distance);
    
    // Возвращаем обратно из центра
    return {
      x: projected.x + centerX,
      y: projected.y + centerY
    };
  });
  
  // Проверяем, существует ли уже перспективное изображение
  let perspectiveImage = window.activePerspectiveGroup.findOne('.perspective-image');
  
  // Получаем HTML изображение
  const htmlImage = image.image();
  
  if (!perspectiveImage) {
    // Сохраняем данные в переменных для использования в замыкании
    const imageData = {
      htmlImage: htmlImage,
      originalWidth: width,
      originalHeight: height,
      corners: transformedCorners
    };
    
    // Создаём новое перспективное изображение с кастомной функцией рисования
    perspectiveImage = new Konva.Shape({
      name: 'perspective-image',
      visible: true,
      // Кастомная функция рисования с перспективной трансформацией
      sceneFunc: function(context) {
        const ctx = context._context;
        // Используем замыкание для доступа к данным
        const img = imageData.htmlImage;
        const corners = imageData.corners;
        const w = imageData.originalWidth;
        const h = imageData.originalHeight;
        
        if (!img || !corners || corners.length !== 4) return;
        
        // Сохраняем текущее состояние контекста
        ctx.save();
        
        // Исходные координаты углов изображения
        const srcCorners = [
          { x: 0, y: 0 },      // Верхний левый
          { x: w, y: 0 },      // Верхний правый
          { x: w, y: h },      // Нижний правый
          { x: 0, y: h }       // Нижний левый
        ];
        
        // Рисуем изображение через два треугольника для перспективной трансформации
        // Треугольник 1: верхний левый, верхний правый, нижний правый
        drawPerspectiveTriangle(ctx, img, 
          srcCorners[0], srcCorners[1], srcCorners[2],
          corners[0], corners[1], corners[2]);
        
        // Треугольник 2: верхний левый, нижний правый, нижний левый
        drawPerspectiveTriangle(ctx, img,
          srcCorners[0], srcCorners[2], srcCorners[3],
          corners[0], corners[2], corners[3]);
        
        // Восстанавливаем состояние контекста
        ctx.restore();
      }
    });
    
    // Сохраняем ссылку на imageData в узле для обновления
    perspectiveImage._perspectiveData = imageData;
    
    // Скрываем оригинальное изображение
    image.visible(false);
    
    // Добавляем перспективное изображение в группу
    window.activePerspectiveGroup.add(perspectiveImage);
  } else {
    // Обновляем данные существующего перспективного изображения
    if (perspectiveImage._perspectiveData) {
      perspectiveImage._perspectiveData.corners = transformedCorners;
      perspectiveImage._perspectiveData.htmlImage = htmlImage;
    }
    
    // Очищаем кэш и принудительно перерисовываем форму
    if (perspectiveImage.cache) {
      perspectiveImage.clearCache();
    }
  }
  
  // Обновляем холст
  window.canvasLayer.draw();
  
  // Обновляем список слоёв
  if (typeof updateLayersList === 'function') {
    updateLayersList();
  }
  
  // Закрываем модальное окно
  close3DTransformModal();
  
  console.log('3D-преобразование применено:', { angleX, angleY, angleZ });
}

// Сбрасывает 3D-преобразование (возвращает изображение в исходное состояние)
function reset3DTransform() {
  if (!window.activePerspectiveGroup) {
    return;
  }
  
  // Сохраняем состояние для истории отмены
  if (typeof window.saveHistoryState === 'function') {
    window.saveHistoryState();
  }
  
  // Получаем изображения
  const normalImage = window.activePerspectiveGroup.findOne('.normal-image');
  const perspectiveImage = window.activePerspectiveGroup.findOne('.perspective-image');
  
  if (perspectiveImage) {
    // Удаляем перспективное изображение
    perspectiveImage.destroy();
  }
  
  if (normalImage) {
    // Показываем оригинальное изображение
    normalImage.visible(true);
  }
  
  // Сбрасываем углы
  window.activePerspectiveGroup.setAttr('perspectiveAngles', { x: 0, y: 0, z: 0 });
  
  // Обнуляем поля ввода
  document.getElementById('angleX').value = 0;
  document.getElementById('angleY').value = 0;
  document.getElementById('angleZ').value = 0;
  
  // Обновляем холст
  window.canvasLayer.draw();
  
  // Обновляем список слоёв
  if (typeof updateLayersList === 'function') {
    updateLayersList();
  }
  
  console.log('3D-преобразование сброшено');
}

// Функция для скрытия контролов 3D (вызывается при экспорте)
function hide3DTransformControls(group) {
  // Эта функция нужна для совместимости с app.js
  // В текущей реализации контролов нет, но функция должна существовать
}

// ========================================
// ИНИЦИАЛИЗАЦИЯ ОБРАБОТЧИКОВ СОБЫТИЙ
// ========================================

// Кнопка открытия модального окна
const btn3DTransform = document.getElementById('btn3DTransform');
if (btn3DTransform) {
  btn3DTransform.addEventListener('click', open3DTransformModal);
}

// Кнопка закрытия модального окна
const closeModal = document.getElementById('closeModal');
if (closeModal) {
  closeModal.addEventListener('click', close3DTransformModal);
}

// Кнопка "Преобразовать"
const btnApply3D = document.getElementById('btnApply3D');
if (btnApply3D) {
  btnApply3D.addEventListener('click', apply3DTransform);
}

// Кнопка "Сбросить"
const btnReset3D = document.getElementById('btnReset3D');
if (btnReset3D) {
  btnReset3D.addEventListener('click', reset3DTransform);
}

// Закрытие модального окна при клике на фон
const modal = document.getElementById('transform3DModal');
if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      close3DTransformModal();
    }
  });
}

// Делаем функции доступными глобально
window.open3DTransformModal = open3DTransformModal;
window.close3DTransformModal = close3DTransformModal;
window.apply3DTransform = apply3DTransform;
window.reset3DTransform = reset3DTransform;
window.hide3DTransformControls = hide3DTransformControls;

console.log('Модуль 3D-преобразования загружен');

