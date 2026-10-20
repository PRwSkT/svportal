'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ParentLoginView } from '@/components/parents/ParentLoginView';

export default function ParentsLoginPage() {
  const router = useRouter();

  const handleLoginSuccess = () => {
    router.replace('/parents');
  };

  return <ParentLoginView onLoginSuccess={handleLoginSuccess} />;
}
