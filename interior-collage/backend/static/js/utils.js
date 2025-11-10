// ========================================
// МОДУЛЬ: UTILS (Вспомогательные функции)
// Общие функции, которые используются везде
// ========================================

// Задержка выполнения функции (для поиска, чтобы не дергать сервер при каждом символе)
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Получить все группы с изображениями на холсте
function getImageGroups() {
  if (!window.canvasLayer) return [];
  
  const groups = [];
  const children = window.canvasLayer.getChildren();
  
  children.forEach(child => {
    if (child.getAttr && child.getAttr('isImageItem')) {
      groups.push(child);
    }
  });
  
  return groups;
}

