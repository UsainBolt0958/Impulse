import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AdminPortalPage from '../../src/pages/AdminPortalPage.jsx';
import AdminAccessGate from '../../src/admin/AdminAccessGate.jsx';
import BillingAdminPanel from '../../src/admin/BillingAdminPanel.jsx';
import '../../src/index.css';

createRoot(document.getElementById('root')).render(
	<BrowserRouter>
		<Routes>
			<Route path="/billing" element={<AdminAccessGate><BillingAdminPanel /></AdminAccessGate>} />
			<Route path="*" element={<AdminAccessGate><AdminPortalPage /></AdminAccessGate>} />
		</Routes>
	</BrowserRouter>
);
