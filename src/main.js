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

// Yeni DOM Elemanları
const todoPriority = document.getElementById('todo-priority');
const todoCategory = document.getElementById('todo-category');
const todoDueDate = document.getElementById('todo-due-date');
const todoSearch = document.getElementById('todo-search');
const todoSort = document.getElementById('todo-sort');
const themeToggle = document.getElementById('theme-toggle');
const themeToggleIcon = document.getElementById('theme-toggle-icon');
const progressBar = document.getElementById('progress-bar');

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

// Meta Veri Serileştirme (Title alanında gizli veri saklama)
function serializeTodoTitle(title, priority, category, dueDate) {
  return `${title} ||p:${priority || 'medium'}||d:${dueDate || ''}||c:${category || 'personal'}`;
}

// Meta Veri Çözümleme (Deserialization)
function deserializeTodo(todo) {
  if (!todo) return null;
  const metaRegex = /\s*\|\|p:(.*?)\|\|d:(.*?)\|\|c:(.*?)$/;
  const match = todo.title.match(metaRegex);
  
  if (match) {
    return {
      ...todo,
      rawTitle: todo.title, // Pocketbase için orijinal title değerini saklıyoruz
      title: todo.title.replace(metaRegex, ''),
      priority: match[1] || 'medium',
      dueDate: match[2] || '',
      category: match[3] || 'personal'
    };
  }
  
  // Eski/Varsayılan veriler için uyumluluk
  return {
    ...todo,
    rawTitle: todo.title,
    priority: 'medium',
    dueDate: '',
    category: 'personal'
  };
}

// Temayı Başlat ve Yönet
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark-theme');
    updateThemeIcon('dark');
  } else {
    document.documentElement.classList.remove('dark-theme');
    updateThemeIcon('light');
  }
  
  themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark-theme');
    const newTheme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  });
}

function updateThemeIcon(theme) {
  if (theme === 'dark') {
    // Güneş ikonu (Açık temaya geçiş için)
    themeToggleIcon.innerHTML = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
  } else {
    // Ay ikonu (Karanlık temaya geçiş için)
    themeToggleIcon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
  }
}

// Uygulamayı Başlat
async function init() {
  // Temayı yükle
  initTheme();

  // Bağlantıyı kontrol et
  const connected = await initPocketBaseConnection();
  updateConnectionBadge(connected);

  // Todo verilerini çek ve meta verilerini çözümle
  const rawTodos = await getTodos();
  todos = rawTodos.map(deserializeTodo);
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
  // İlerleme Çubuğunu Güncelle (Tüm görevler üzerinden)
  const totalTodosCount = todos.length;
  const completedTodosCount = todos.filter(t => t.completed).length;
  const progressPercent = totalTodosCount > 0 ? Math.round((completedTodosCount / totalTodosCount) * 100) : 0;
  progressBar.style.width = `${progressPercent}%`;

  // Arama filtresi
  const searchQuery = todoSearch.value.trim().toLowerCase();

  // Filtreleme (Durum + Arama)
  let filteredTodos = todos.filter(todo => {
    if (currentFilter === 'active' && todo.completed) return false;
    if (currentFilter === 'completed' && !todo.completed) return false;
    
    if (searchQuery) {
      return todo.title.toLowerCase().includes(searchQuery);
    }
    return true;
  });

  // Sıralama
  const sortBy = todoSort.value;
  filteredTodos.sort((a, b) => {
    if (sortBy === 'date-old') {
      return new Date(a.created) - new Date(b.created);
    }
    if (sortBy === 'priority') {
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const weightA = priorityWeight[a.priority] || 2;
      const weightB = priorityWeight[b.priority] || 2;
      if (weightA !== weightB) {
        return weightB - weightA; // Yüksek öncelik üstte
      }
      return new Date(b.created) - new Date(a.created); // Öncelik eşitse yeni olan üstte
    }
    if (sortBy === 'due-date') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate) - new Date(b.dueDate);
    }
    // Varsayılan: 'date-new'
    return new Date(b.created) - new Date(a.created);
  });

  // Listeyi temizle
  todoList.innerHTML = '';

  if (filteredTodos.length === 0) {
    emptyState.classList.remove('hidden');
    todoList.classList.add('hidden');
    
    // Boş durum metnini filtreye/aramaya göre güncelle
    const emptyText = document.getElementById('empty-text');
    if (searchQuery) {
      emptyText.textContent = 'Aramanızla eşleşen görev bulunamadı.';
    } else if (currentFilter === 'active') {
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

      // Kategori etiketi
      const categoryLabels = {
        personal: '🏠 Kişisel',
        work: '💼 İş',
        shopping: '🛒 Alışveriş',
        study: '📚 Eğitim',
        health: '🎯 Sağlık'
      };
      const catLabel = categoryLabels[todo.category] || '🏠 Kişisel';

      // Öncelik etiketi
      const priorityLabels = {
        low: 'Düşük',
        medium: 'Orta',
        high: 'Yüksek'
      };
      const priorityLabel = priorityLabels[todo.priority] || 'Orta';

      // Bitiş Tarihi etiketi
      let dueDateBadge = '';
      if (todo.dueDate) {
        const todayStr = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        let dueClass = 'due';
        let dueText = todo.dueDate;

        try {
          const dateObj = new Date(todo.dueDate);
          const options = { day: 'numeric', month: 'short' };
          dueText = dateObj.toLocaleDateString('tr-TR', options);
        } catch (e) {}

        if (todo.dueDate < todayStr && !todo.completed) {
          dueClass = 'due overdue';
          dueText = `Gecikti: ${dueText}`;
        } else if (todo.dueDate === todayStr) {
          dueClass = 'due today';
          dueText = `Bugün`;
        } else if (todo.dueDate === tomorrowStr) {
          dueText = `Yarın`;
        }

        dueDateBadge = `<span class="meta-badge ${dueClass}">📅 ${dueText}</span>`;
      }

      li.innerHTML = `
        <div class="todo-left">
          <div class="custom-checkbox">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <div class="todo-content-wrapper">
            <span class="todo-text">${escapeHTML(todo.title)}</span>
            <div class="todo-meta-row">
              <span class="meta-badge category">${catLabel}</span>
              <span class="meta-badge p-${todo.priority}">${priorityLabel}</span>
              ${dueDateBadge}
            </div>
          </div>
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

    const priority = todoPriority.value;
    const category = todoCategory.value;
    const dueDate = todoDueDate.value;
    const serializedTitle = serializeTodoTitle(title, priority, category, dueDate);

    // Formu sıfırla
    todoInput.value = '';
    todoDueDate.value = '';
    todoPriority.value = 'medium';
    todoCategory.value = 'personal';

    // Optimistik Güncelleme: UI'a anında ekle
    const tempId = 'temp_' + Date.now();
    const tempTodo = {
      id: tempId,
      title: title,
      rawTitle: serializedTitle,
      priority: priority,
      category: category,
      dueDate: dueDate,
      completed: false,
      created: new Date().toISOString()
    };

    todos.unshift(tempTodo);
    render();

    // Arka planda sunucuya yaz
    const savedTodo = await createTodo(serializedTitle);
    
    // Geçici Todo'yu gerçek veritabanı verisiyle değiştir
    const index = todos.findIndex(t => t.id === tempId);
    if (index !== -1 && savedTodo) {
      todos[index] = deserializeTodo(savedTodo);
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

  // Arama Kutusu Değişimi
  todoSearch.addEventListener('input', () => {
    render();
  });

  // Sıralama Seçimi Değişimi
  todoSort.addEventListener('change', () => {
    render();
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
