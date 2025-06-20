import React from 'react';

const LoadingSpinner = () => {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center">
        <div className="h-12 w-12 rounded-full border-4 border-t-primary-600 border-r-transparent border-b-primary-300 border-l-primary-600 animate-spin"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;