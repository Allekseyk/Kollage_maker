// ========================================
// МОДУЛЬ: CATALOG (Каталог товаров)
// Отвечает за боковую панель с товарами
// ========================================

const searchEl = document.getElementById('search');
const categoryEl = document.getElementById('category');
const productsEl = document.getElementById('products');

// Отображение товаров в каталоге
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
      if (window.eraserMode) return; // В режиме ластика не добавляем изображения
      console.log('[catalog click]', p.name);
      const imageUrl = p.id ? `/api/image/${p.id}` : p.image_url;
      addImageToCanvas(imageUrl, p.name);
    });
    productsEl.appendChild(card);
  });
}

// Инициализация каталога
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

// Перезагрузка списка товаров с фильтрами
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

// Обработчики поиска и фильтров
searchEl.addEventListener('input', debounce(reloadProducts, 300));
categoryEl.addEventListener('change', reloadProducts);

