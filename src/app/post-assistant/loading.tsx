import React from 'react';

export default function PostAssistantLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4 animate-pulse">
      <div className="h-24 rounded-2xl bg-white/80 border border-slate-200" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 space-y-4">
          <div className="h-56 rounded-2xl bg-white/80 border border-slate-200" />
          <div className="h-96 rounded-2xl bg-white/80 border border-slate-200" />
        </div>
        <div className="lg:col-span-7 space-y-4">
          <div className="h-80 rounded-2xl bg-white/80 border border-slate-200" />
          <div className="h-72 rounded-2xl bg-white/80 border border-slate-200" />
        </div>
      </div>
    </div>
  );
}
