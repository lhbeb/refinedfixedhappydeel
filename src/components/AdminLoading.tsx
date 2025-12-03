import React from 'react';
import { OrbitProgress } from 'react-loading-indicators';

interface AdminLoadingProps {
  message?: string;
}

export default function AdminLoading({ message = 'Loading...' }: AdminLoadingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="flex flex-col items-center gap-6 p-8 bg-white rounded-2xl shadow-xl">
        <OrbitProgress color="#0046be" size="medium" text="" textColor="" />
        
        <div className="flex flex-col items-center gap-2">
          <p className="text-lg font-semibold text-gray-900">{message}</p>
        </div>
      </div>
    </div>
  );
}

