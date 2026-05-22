import PocketBase from 'pocketbase';

// PocketBase sunucu adresi: Yerel geliştirme yaparken 8090 portuna bağlanır, 
// pb_public içinden sunulduğunda veya canlıda kendi alan adını (window.location.origin) kullanır.
const POCKETBASE_URL = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '8090'
    ? 'http://127.0.0.1:8090'
    : window.location.origin
  : 'http://127.0.0.1:8090';

const pb = new PocketBase(POCKETBASE_URL);

let usePocketBase = false;

// PocketBase sunucusunun aktif olup olmadığını kontrol eder
export async function initPocketBaseConnection() {
  try {
    const health = await pb.health.check();
    if (health && health.code === 200) {
      usePocketBase = true;
      console.log('PocketBase bağlantısı başarılı. Bulut modu aktif.');
    } else {
      usePocketBase = false;
      console.warn('PocketBase yanıt verdi ancak geçersiz kod döndürdü. Yerel moda geçiliyor.');
    }
  } catch (error) {
    usePocketBase = false;
    console.warn('PocketBase sunucusuna ulaşılamadı. Yerel mod (LocalStorage) aktif.', error);
  }
  return usePocketBase;
}

export function isConnected() {
  return usePocketBase;
}

// LocalStorage yardımcı işlevleri
const LOCAL_STORAGE_KEY = 'minimalist_todos';

function getLocalTodos() {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveLocalTodos(todos) {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(todos));
}

// TODO Ekleme
export async function createTodo(title) {
  if (usePocketBase) {
    try {
      const record = await pb.collection('todos').create({
        title: title,
        completed: false,
      });
      return record;
    } catch (error) {
      console.error('PocketBase todo oluşturma hatası, yerel yazılıyor...', error);
    }
  }
  
  // LocalStorage Fallback
  const newTodo = {
    id: 'local_' + Date.now() + Math.random().toString(36).substr(2, 5),
    title,
    completed: false,
    created: new Date().toISOString()
  };
  const todos = getLocalTodos();
  todos.unshift(newTodo);
  saveLocalTodos(todos);
  return newTodo;
}

// TODO Listeleme
export async function getTodos() {
  if (usePocketBase) {
    try {
      const records = await pb.collection('todos').getFullList({
        sort: '-created',
      });
      return records;
    } catch (error) {
      console.error('PocketBase todo listeleme hatası, yerel veriler yükleniyor...', error);
    }
  }
  
  // LocalStorage Fallback
  return getLocalTodos().sort((a, b) => new Date(b.created) - new Date(a.created));
}

// TODO Güncelleme
export async function updateTodo(id, data) {
  if (usePocketBase && !id.startsWith('local_')) {
    try {
      const record = await pb.collection('todos').update(id, data);
      return record;
    } catch (error) {
      console.error('PocketBase güncelleme hatası:', error);
    }
  }

  // LocalStorage Fallback
  const todos = getLocalTodos();
  const index = todos.findIndex(t => t.id === id);
  if (index !== -1) {
    todos[index] = { ...todos[index], ...data };
    saveLocalTodos(todos);
    return todos[index];
  }
  return null;
}

// TODO Silme
export async function deleteTodo(id) {
  if (usePocketBase && !id.startsWith('local_')) {
    try {
      await pb.collection('todos').delete(id);
      return true;
    } catch (error) {
      console.error('PocketBase silme hatası:', error);
    }
  }

  // LocalStorage Fallback
  const todos = getLocalTodos();
  const filtered = todos.filter(t => t.id !== id);
  saveLocalTodos(filtered);
  return true;
}
