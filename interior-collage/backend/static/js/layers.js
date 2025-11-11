// ========================================
// МОДУЛЬ: LAYERS (Управление слоями)
// Отвечает за панель слоёв справа
// ========================================

const layersList = document.getElementById('layers-list');

// Обновление списка слоев
function updateLayersList() {
  if (!layersList) {
    console.warn('layersList не найден!');
    return;
  }
  
  // Очищаем список
  layersList.innerHTML = '';
  
  // Получаем все группы изображений
  const groups = getImageGroups();
  console.log('updateLayersList: найдено групп:', groups.length);
  
  if (groups.length === 0) {
    console.log('Нет групп для отображения в слоях');
    return;
  }
  
  // Показываем слои в обратном порядке (верхние сверху)
  const orderedGroups = [...groups].reverse();

  orderedGroups.forEach((group, index) => {
    const actualIndex = groups.indexOf(group);
    const layerItem = document.createElement('div');
    layerItem.className = 'layer-item';
    
    // Проверяем, выбран ли этот слой
    if (group.hasName('selected')) {
      layerItem.classList.add('selected');
    }
    
    // Создаем превью изображения
    const preview = document.createElement('canvas');
    preview.className = 'layer-preview';
    preview.width = 200;
    preview.height = 60;
    const previewCtx = preview.getContext('2d');
    
    // Рисуем миниатюру изображения
    // Ищем изображение в группе
    let imageNode = null;
    const children = group.getChildren();
    for (let child of children) {
      if (child.getType && child.getType() === 'Image' && child.name() === 'normal-image') {
        imageNode = child;
        break;
      }
    }
    
    // Если не нашли через имя, ищем любое изображение
    if (!imageNode) {
      for (let child of children) {
        if (child.getType && child.getType() === 'Image') {
          imageNode = child;
          break;
        }
      }
    }
    
    if (imageNode && imageNode.image()) {
      const img = imageNode.image();
      if (img && img.complete) {
        const scale = Math.min(200 / img.width, 60 / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        const x = (200 - w) / 2;
        const y = (60 - h) / 2;
        previewCtx.drawImage(img, x, y, w, h);
      }
    }
    
    // Название слоя
    const layerName = document.createElement('div');
    layerName.className = 'layer-name';
    const displayName = group.getAttr('displayName') || `Слой ${actualIndex + 1}`;
    layerName.textContent = displayName;
    
    // Кнопки управления
    const controls = document.createElement('div');
    controls.className = 'layer-controls';
    
    // Кнопка "Копировать"
    const btnCopy = document.createElement('button');
    btnCopy.className = 'layer-btn';
    btnCopy.textContent = '📋 Копировать';
    btnCopy.addEventListener('click', (e) => {
      e.stopPropagation();
      duplicateLayer(group);
    });
    
    // Кнопка "Вверх"
    const btnUp = document.createElement('button');
    btnUp.className = 'layer-btn';
    btnUp.textContent = '⬆';
    btnUp.disabled = actualIndex === groups.length - 1;
    btnUp.addEventListener('click', (e) => {
      e.stopPropagation();
      moveLayerUp(group);
    });
    
    // Кнопка "Вниз"
    const btnDown = document.createElement('button');
    btnDown.className = 'layer-btn';
    btnDown.textContent = '⬇';
    btnDown.disabled = actualIndex === 0;
    btnDown.addEventListener('click', (e) => {
      e.stopPropagation();
      moveLayerDown(group);
    });
    
    controls.appendChild(btnCopy);
    controls.appendChild(btnUp);
    controls.appendChild(btnDown);
    
    // Клик по слою для выбора
    layerItem.addEventListener('click', () => {
      selectLayer(group);
    });
    
    layerItem.appendChild(preview);
    layerItem.appendChild(layerName);
    layerItem.appendChild(controls);
    layersList.appendChild(layerItem);
  });
}

// Выбор слоя
function selectLayer(group) {
  // Убираем выделение со всех слоев
  getImageGroups().forEach(g => {
    if (g.hasName('selected')) {
      g.removeName('selected');
    }
  });
  
  // В обычном режиме (режим трансформации был удалён)
  // Проверяем, что группа существует перед выделением
  try {
    if (group.getParent()) {
      window.canvasTransformer.nodes([group]);
      group.addName('selected');
      window.canvasLayer.draw();
      updateLayersList();
    }
  } catch (e) {
    console.warn('Ошибка при выборе слоя:', e);
  }
}

// Копирование слоя
function duplicateLayer(group) {
  // Сохраняем состояние перед копированием
  if (typeof window.saveHistoryState === 'function') {
    window.saveHistoryState();
  }
  
  // Ищем изображение в группе
  let imageNode = null;
  const children = group.getChildren();
  for (let child of children) {
    if (child.getType && child.getType() === 'Image' && child.name() === 'normal-image') {
      imageNode = child;
      break;
    }
  }
  
  if (!imageNode || !imageNode.image()) return;
  
  const img = imageNode.image();
  const originalName = group.getAttr('displayName') || 'Слой';
  const newDisplayName = `${originalName} (копия)`;
  
  // Создаем новую группу со смещением
  const newGroup = createImage(
    img,
    group.x() + 20,
    group.y() + 20,
    imageNode.width(),
    imageNode.height(),
    newDisplayName
  );
  
  // Копируем трансформации
  newGroup.rotation(group.rotation());
  newGroup.scale(group.scale());
  
  // Добавляем на холст
  window.canvasLayer.add(newGroup);
  window.canvasLayer.draw();
  
  // Обновляем список слоев
  updateLayersList();
}

// Перемещение слоя вверх
function moveLayerUp(group) {
  // Сохраняем состояние перед перемещением
  if (typeof window.saveHistoryState === 'function') {
    window.saveHistoryState();
  }
  
  group.moveUp();
  window.canvasLayer.draw();
  updateLayersList();
}

// Перемещение слоя вниз
function moveLayerDown(group) {
  // Сохраняем состояние перед перемещением
  if (typeof window.saveHistoryState === 'function') {
    window.saveHistoryState();
  }
  
  group.moveDown();
  window.canvasLayer.draw();
  updateLayersList();
}

// Удаление выбранных элементов
function deleteSelected() {
  // Получаем все выделенные группы
  const selectedGroups = getImageGroups().filter(group => {
    // Проверяем, что группа существует и не удалена
    try {
      return group.hasName && group.hasName('selected') && group.getParent();
    } catch (e) {
      return false;
    }
  });
  
  if (selectedGroups.length === 0) {
    console.log('Нет выделенных элементов для удаления');
    return;
  }
  
  // Сохраняем состояние перед удалением
  if (typeof window.saveHistoryState === 'function') {
    window.saveHistoryState();
  }
  
  // Сначала убираем трансформер, чтобы избежать ошибок
  window.canvasTransformer.nodes([]);
  
  // Удаляем каждую выделенную группу
  selectedGroups.forEach(group => {
    try {
      // Проверяем, что группа всё ещё существует перед удалением
      if (group.getParent()) {
        group.destroy(); // Удаляем группу из Konva
      }
    } catch (e) {
      console.warn('Ошибка при удалении группы:', e);
    }
  });
  
  // Перерисовываем холст
  window.canvasLayer.draw();
  
  // Обновляем список слоёв
  updateLayersList();
}

// Делаем функцию доступной глобально
window.deleteSelected = deleteSelected;

