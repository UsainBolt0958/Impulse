import React from 'react';
import { createRoot } from 'react-dom/client';
import AdminPortalPage from '@/pages/AdminPortalPage.jsx';
import '@/index.css';

function AdminApp() {
  return <AdminPortalPage />;
}

createRoot(document.getElementById('root')).render(<AdminApp />);
