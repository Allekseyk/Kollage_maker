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

// Трансформер для масштабирования/вращения
const transformer = new Konva.Transformer({
  rotateEnabled: true,
  enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
});
layer.add(transformer);

// Ресайз
window.addEventListener('resize', () => {
  stage.size({ width: width(), height: height() });
});

// Снятие выделения по клику в пустоту
stage.on('mousedown', (e) => {
  if (e.target === stage) {
    transformer.nodes([]);
    layer.draw();
  }
});

// Удаление выбранного элемента
function deleteSelected() {
  const nodes = transformer.nodes();
  if (nodes && nodes.length > 0) {
    nodes.forEach(n => n.destroy());
    transformer.nodes([]);
    layer.draw();
  }
}

function addImageToCanvas(url, name) {
  const img = new Image();
  console.log('[addImageToCanvas] start', { url, name });
  img.onload = () => {
    console.log('[addImageToCanvas] loaded', { w: img.width, h: img.height });
    const kImg = new Konva.Image({
      image: img,
      x: stage.width() / 2 - img.width / 4,
      y: stage.height() / 2 - img.height / 4,
      draggable: true,
      scaleX: 0.5,
      scaleY: 0.5,
      name: name || 'item',
    });

    kImg.on('mousedown', () => {
      transformer.nodes([kImg]);
      layer.draw();
    });

    kImg.on('transform', () => {
      const minScale = 0.1;
      kImg.scaleX(Math.max(kImg.scaleX(), minScale));
      kImg.scaleY(Math.max(kImg.scaleY(), minScale));
    });

    layer.add(kImg);
    transformer.nodes([kImg]);
    layer.draw();
    console.log('[addImageToCanvas] drawn');
  };
  img.onerror = () => {
    console.warn('Не удалось загрузить изображение:', url);
  };
  img.src = `/api/proxy?url=${encodeURIComponent(url)}`;
}

function renderProducts(items) {
  productsEl.innerHTML = '';
  items.forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.title = p.name;

    const img = document.createElement('img');
    // Используем новый endpoint для изображений из базы данных
    if (p.id) {
      img.src = `/api/image/${p.id}`;
    } else if (p.image_url) {
      // Fallback: если нет id, используем старый способ через прокси
      img.src = `/api/proxy?url=${encodeURIComponent(p.image_url)}`;
    }
    img.alt = p.name;
    img.onerror = function() {
      // Если не удалось загрузить изображение, пробуем через прокси (для обратной совместимости)
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
      console.log('[catalog click]', p.name);
      // Для canvas тоже используем новый endpoint, если есть id
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
  layer.add(transformer);
  layer.draw();
});

btnExport.addEventListener('click', () => {
  transformer.nodes([]);
  layer.draw();
  const dataURL = stage.toDataURL({ pixelRatio: 2 });
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = 'collage.png';
  a.click();
});

btnDelete.addEventListener('click', deleteSelected);

// Удаление по клавишам Delete / Backspace
window.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    // предотвращаем удаление текста в инпутах
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (tag.toLowerCase() === 'input' || tag.toLowerCase() === 'textarea') return;
    deleteSelected();
  }
});

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

initCatalog();


