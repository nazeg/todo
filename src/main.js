import './style.css';
import { 
  initPocketBaseConnection, 
  isConnected, 
  getTodos, 
  createTodo, 
  updateTodo, 
  deleteTodo 
} from './pocketbase.js';

// Yerel Durum (State)
let todos = [];
let currentFilter = 'all';

// DOM Elemanları
const todoForm = document.getElementById('todo-form');
const todoInput = document.getElementById('todo-input');
const todoList = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');
const itemsLeft = document.getElementById('items-left');
const clearCompletedBtn = document.getElementById('clear-completed-btn');
const connectionBadge = document.getElementById('connection-badge');
const badgeText = document.getElementById('badge-text');

// Filtre Butonları
const filterBtns = {
  all: document.getElementById('filter-all'),
  active: document.getElementById('filter-active'),
  completed: document.getElementById('filter-completed'),
};

// Güvenli HTML Çıktısı (XSS Önleme)
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Uygulamayı Başlat
async function init() {
  // Bağlantıyı kontrol et (Timeout süresi içerir)
  const connected = await initPocketBaseConnection();
  updateConnectionBadge(connected);

  // Todo verilerini çek
  todos = await getTodos();
  render();
  
  // Olay Dinleyicileri (Event Listeners) Tanımla
  setupEventListeners();
}

// Bağlantı Rozetini Güncelle
function updateConnectionBadge(connected) {
  connectionBadge.className = 'badge'; // Reset classes
  if (connected) {
    connectionBadge.classList.add('online');
    badgeText.textContent = 'PocketBase: Aktif';
  } else {
    connectionBadge.classList.add('offline');
    badgeText.textContent = 'PocketBase: Yerel Mod';
  }
}

// Todo Listesini Arayüze Çiz
function render() {
  // Filtreleme
  const filteredTodos = todos.filter(todo => {
    if (currentFilter === 'active') return !todo.completed;
    if (currentFilter === 'completed') return todo.completed;
    return true; // 'all'
  });

  // Listeyi temizle
  todoList.innerHTML = '';

  if (filteredTodos.length === 0) {
    emptyState.classList.remove('hidden');
    todoList.classList.add('hidden');
    
    // Boş durum metnini filtreye göre güncelle
    const emptyText = document.getElementById('empty-text');
    if (currentFilter === 'active') {
      emptyText.textContent = 'Aktif bir göreviniz bulunmuyor.';
    } else if (currentFilter === 'completed') {
      emptyText.textContent = 'Tamamlanmış bir göreviniz bulunmuyor.';
    } else {
      emptyText.textContent = 'Yapılacak hiçbir görev yok! Yeni bir tane ekleyin.';
    }
  } else {
    emptyState.classList.add('hidden');
    todoList.classList.remove('hidden');

    filteredTodos.forEach(todo => {
      const li = document.createElement('li');
      li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
      li.dataset.id = todo.id;

      li.innerHTML = `
        <div class="todo-left">
          <div class="custom-checkbox">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <span class="todo-text">${escapeHTML(todo.title)}</span>
        </div>
        <button class="delete-btn" aria-label="Görevi Sil">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      `;

      // Görev Tamamlama/Geri Alma Tıklama Etkinliği
      li.querySelector('.todo-left').addEventListener('click', () => {
        toggleTodoCompletion(todo.id);
      });

      // Görev Silme Tıklama Etkinliği
      li.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removeTodo(todo.id);
      });

      todoList.appendChild(li);
    });
  }

  // İstatistikleri güncelle
  const activeCount = todos.filter(t => !t.completed).length;
  itemsLeft.textContent = `${activeCount} görev kaldı`;
}

// Olay Dinleyicilerini Kur
function setupEventListeners() {
  // Form Gönderimi (Yeni Todo Ekleme)
  todoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = todoInput.value.trim();
    if (!title) return;

    todoInput.value = '';

    // Optimistik Güncelleme: UI'a anında ekle
    const tempId = 'temp_' + Date.now();
    const tempTodo = {
      id: tempId,
      title: title,
      completed: false,
      created: new Date().toISOString()
    };

    todos.unshift(tempTodo);
    render();

    // Arka planda sunucuya yaz
    const savedTodo = await createTodo(title);
    
    // Geçici Todo'yu gerçek veritabanı verisiyle değiştir
    const index = todos.findIndex(t => t.id === tempId);
    if (index !== -1 && savedTodo) {
      todos[index] = savedTodo;
      render();
    }
  });

  // Filtre Butonları Tıklamaları
  Object.keys(filterBtns).forEach(filter => {
    filterBtns[filter].addEventListener('click', () => {
      // Active sınıfını taşı
      Object.values(filterBtns).forEach(btn => btn.classList.remove('active'));
      filterBtns[filter].classList.add('active');
      
      currentFilter = filter;
      render();
    });
  });

  // Tamamlananları Temizle
  clearCompletedBtn.addEventListener('click', async () => {
    const completedTodos = todos.filter(t => t.completed);
    if (completedTodos.length === 0) return;

    // Optimistik Güncelleme
    todos = todos.filter(t => !t.completed);
    render();

    // Arka planda sunucudan/yerelden sil
    for (const todo of completedTodos) {
      await deleteTodo(todo.id);
    }
  });
}

// Görev Durumunu Değiştir
async function toggleTodoCompletion(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;

  const newCompletedState = !todo.completed;

  // Optimistik Güncelleme
  todo.completed = newCompletedState;
  render();

  // Arka planda sunucuya/yerel depoya kaydet
  const updated = await updateTodo(id, { completed: newCompletedState });
  if (!updated) {
    // Başarısız olursa durumu geri al
    todo.completed = !newCompletedState;
    render();
  }
}

// Görevi Sil
async function removeTodo(id) {
  const index = todos.findIndex(t => t.id === id);
  if (index === -1) return;

  const deletedTodo = todos[index];

  // Optimistik Güncelleme
  todos.splice(index, 1);
  render();

  // Arka planda sunucudan/yerel depodan sil
  const success = await deleteTodo(id);
  if (!success) {
    // Başarısız olursa listeye geri ekle
    todos.splice(index, 0, deletedTodo);
    render();
  }
}

// Uygulamayı Başlat
document.addEventListener('DOMContentLoaded', init);
