import React from 'react';
import Sidebar from './Sidebar';

const DashboardLayout = ({ children, title }) => {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <header className="h-16 bg-white border-b border-gray-200 shadow-sm flex items-center px-8">
          <h1 className="text-xl font-bold text-gray-800">{title}</h1>
        </header>
        <main className="p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;