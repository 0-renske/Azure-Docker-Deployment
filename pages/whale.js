import React from 'react';
import { useRouter } from 'next/router';

export default function Whale() {
  const router = useRouter();

  const handleChooseWhale = () => {
    router.push('/manage');
  };

  return (
    <div className="bg-blue-50 border border-blue-300 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-800">Whale</h3>
        <span className="bg-blue-600 text-white text-xs font-semibold px-2.5 py-0.5 rounded">Enterprise</span>
      </div>
      <div className="mb-4">
        <span className="text-3xl font-bold text-gray-900">79 eur</span>
        <span className="text-gray-500 text-sm">/month</span>
      </div>
      <p className="text-gray-600 mb-6">Enterprise-grade solution for large scale applications</p>
      <ul className="space-y-3 mb-6">
        <li className="flex items-center">
          <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
          </svg>
          <span className="text-gray-600">Unlimited Vector Databases</span>
        </li>
        <li className="flex items-center">
          <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
          </svg>
          <span className="text-gray-600">Unlimited vectors</span>
        </li>
        <li className="flex items-center">
          <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
          </svg>
          <span className="text-gray-600">Full API access</span>
        </li>
        <li className="flex items-center">
          <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
          </svg>
          <span className="text-gray-600">24/7 priority support</span>
        </li>
        <li className="flex items-center">
          <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
          </svg>
          <span className="text-gray-600">Custom integrations</span>
        </li>
        <li className="flex items-center">
          <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
          </svg>
          <span className="text-gray-600">Dedicated account manager</span>
        </li>
      </ul>
      <button 
        onClick={handleChooseWhale}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
      >
        Choose Whale
      </button>
    </div>
  );
}
