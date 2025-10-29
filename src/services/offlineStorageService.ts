import { Contact } from '../types/contact';
import { Deal } from '../types';

interface QueuedOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: 'contact' | 'deal';
  entityId: string;
  data: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'failed';
}

interface OfflineData {
  contacts: Contact[];
  deals: Deal[];
  lastSync: number;
}

class OfflineStorageService {
  private dbName = 'smart-crm-offline';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private isSupported: boolean = false;

  constructor() {
    this.isSupported = typeof indexedDB !== 'undefined';
    if (this.isSupported) {
      this.initializeDB();
    }
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isSupported) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('contacts')) {
          const contactStore = db.createObjectStore('contacts', { keyPath: 'id' });
          contactStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          contactStore.createIndex('company', 'company', { unique: false });
        }

        if (!db.objectStoreNames.contains('deals')) {
          const dealStore = db.createObjectStore('deals', { keyPath: 'id' });
          dealStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          dealStore.createIndex('stage', 'stage', { unique: false });
        }

        if (!db.objectStoreNames.contains('operationQueue')) {
          const queueStore = db.createObjectStore('operationQueue', { keyPath: 'id' });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
          queueStore.createIndex('status', 'status', { unique: false });
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }

        console.log('IndexedDB object stores created');
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initializeDB();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  async saveContacts(contacts: Contact[]): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['contacts'], 'readwrite');
    const store = transaction.objectStore('contacts');

    for (const contact of contacts) {
      store.put(contact);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getContacts(): Promise<Contact[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['contacts'], 'readonly');
    const store = transaction.objectStore('contacts');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveDeals(deals: Deal[]): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['deals'], 'readwrite');
    const store = transaction.objectStore('deals');

    for (const deal of deals) {
      store.put(deal);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getDeals(): Promise<Deal[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['deals'], 'readonly');
    const store = transaction.objectStore('deals');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async queueOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['operationQueue'], 'readwrite');
    const store = transaction.objectStore('operationQueue');

    const queuedOp: QueuedOperation = {
      ...operation,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };

    store.add(queuedOp);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getPendingOperations(): Promise<QueuedOperation[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['operationQueue'], 'readonly');
    const store = transaction.objectStore('operationQueue');
    const index = store.index('status');
    const request = index.getAll('pending');

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async removeOperation(operationId: string): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['operationQueue'], 'readwrite');
    const store = transaction.objectStore('operationQueue');
    store.delete(operationId);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async updateOperationStatus(operationId: string, status: QueuedOperation['status'], retryCount?: number): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['operationQueue'], 'readwrite');
    const store = transaction.objectStore('operationQueue');

    const getRequest = store.get(operationId);

    return new Promise((resolve, reject) => {
      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (operation) {
          operation.status = status;
          if (retryCount !== undefined) {
            operation.retryCount = retryCount;
          }
          store.put(operation);
        }
        resolve();
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async setMetadata(key: string, value: any): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['metadata'], 'readwrite');
    const store = transaction.objectStore('metadata');
    store.put({ key, value });

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getMetadata(key: string): Promise<any> {
    const db = await this.ensureDB();
    const transaction = db.transaction(['metadata'], 'readonly');
    const store = transaction.objectStore('metadata');
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageUsage(): Promise<{ used: number; quota: number; percentUsed: number }> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return { used: 0, quota: 0, percentUsed: 0 };
    }

    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage || 0;
      const quota = estimate.quota || 0;
      const percentUsed = quota > 0 ? (used / quota) * 100 : 0;

      return { used, quota, percentUsed };
    } catch (error) {
      console.error('Failed to get storage estimate:', error);
      return { used: 0, quota: 0, percentUsed: 0 };
    }
  }

  async clearAllData(): Promise<void> {
    const db = await this.ensureDB();
    const stores = ['contacts', 'deals', 'operationQueue', 'metadata'];
    const transaction = db.transaction(stores, 'readwrite');

    for (const storeName of stores) {
      const store = transaction.objectStore(storeName);
      store.clear();
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  isOfflineStorageSupported(): boolean {
    return this.isSupported;
  }

  async exportData(): Promise<OfflineData> {
    const contacts = await this.getContacts();
    const deals = await this.getDeals();
    const lastSync = await this.getMetadata('lastSyncTime') || 0;

    return {
      contacts,
      deals,
      lastSync
    };
  }

  async importData(data: OfflineData): Promise<void> {
    await this.saveContacts(data.contacts);
    await this.saveDeals(data.deals);
    await this.setMetadata('lastSyncTime', data.lastSync);
  }
}

let offlineStorageService: OfflineStorageService | null = null;

export const getOfflineStorageService = (): OfflineStorageService => {
  if (!offlineStorageService) {
    offlineStorageService = new OfflineStorageService();
  }
  return offlineStorageService;
};

export { OfflineStorageService };
export type { QueuedOperation, OfflineData };
