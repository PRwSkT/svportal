import { createClient } from '../supabase/client';

export type QueueAction = 'insert' | 'rpc';

export type QueueItem<T = Record<string, unknown>> = {
  id: string;
  target: string; // table name or rpc name
  action: QueueAction;
  payload: T;
  created_at: string;
  retry_count: number;
};

const QUEUE_KEY = 'pos_offline_queue';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function saveToQueue<T extends Record<string, unknown>>(
  target: string, 
  payload: T, 
  action: QueueAction = 'insert'
): string {
  if (typeof window === 'undefined') return ''; // Safety for SSR

  const queue = getQueue();
  
  const newItem: QueueItem<T> = {
    id: generateUUID(),
    target,
    action,
    payload,
    created_at: new Date().toISOString(),
    retry_count: 0,
  };

  queue.push(newItem as QueueItem<unknown>);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  
  // Try to sync immediately if online
  if (navigator.onLine) {
    setTimeout(() => syncQueue(), 100);
  }
  
  return newItem.id;
}

export function getQueue(): QueueItem<unknown>[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(QUEUE_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as QueueItem<unknown>[];
  } catch {
    return [];
  }
}

export async function syncQueue(): Promise<void> {
  if (typeof window === 'undefined') return;

  const queue = getQueue();
  if (queue.length === 0) return;

  const supabase = createClient();
  const remainingQueue: QueueItem<unknown>[] = [];

  for (const item of queue) {
    try {
      if (item.action === 'rpc') {
        const { error } = await supabase.rpc(item.target, { payload: item.payload });
        if (error) throw error;
      } else {
        const { error } = await supabase.from(item.target).insert(item.payload as Record<string, unknown>);
        if (error) throw error;
      }
      
      console.log(`Successfully synced queued item ${item.id} (${item.action} -> ${item.target})`);
    } catch (err) {
      console.error(`Failed to sync item ${item.id}`, err);
      item.retry_count += 1;
      remainingQueue.push(item);
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
}

// Setup listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Network online. Triggering syncQueue...');
    syncQueue();
  });
}
