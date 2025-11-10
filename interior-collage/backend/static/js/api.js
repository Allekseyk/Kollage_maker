// ========================================
// МОДУЛЬ: API
// Отвечает за все запросы к серверу
// ========================================

const API = {
  // Получить список товаров с фильтрами
  products: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return fetch(`/api/products?${q}`).then(r => r.json());
  },
  
  // Получить список категорий
  categories: () => fetch(`/api/categories`).then(r => r.json()),
};

