import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AdminPortalPage from '../../src/pages/AdminPortalPage.jsx';
import '../../src/index.css';

createRoot(document.getElementById('root')).render(
	<BrowserRouter>
		<AdminPortalPage />
	</BrowserRouter>
);
