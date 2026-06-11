'use client';
import { saveToQueue, getQueue } from '@/lib/queue/offline';
import { useState, useEffect } from 'react';
import { QueueItem } from '@/lib/queue/offline';

export default function OfflineTestClient() {
  const [queue, setQueue] = useState<QueueItem<unknown>[]>([]);

  useEffect(() => {
    // Refresh queue display
    setQueue(getQueue());
    
    const handleOnline = () => {
      // Small delay to allow the background sync to modify localStorage
      setTimeout(() => setQueue(getQueue()), 500); 
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handleWrite = () => {
    saveToQueue('transactions', {
      amount: 1000,
      student_id: "S001",
      transaction_type: "wallet_topup",
      description: "Test offline write"
    });
    setQueue(getQueue());
  };

  return (
    <div>
      <p className="mb-2 text-sm text-gray-600">
        Turn off your network in DevTools, click the button to queue a write, then turn network back on to see it attempt sync.
      </p>
      <button 
        onClick={handleWrite}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-4"
      >
        Trigger Mock Write
      </button>
      
      <h3 className="font-semibold mt-4 mb-2">Current Queue:</h3>
      <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto min-h-[100px]">
        {JSON.stringify(queue, null, 2)}
      </pre>
    </div>
  );
}
