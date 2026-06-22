import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Landing from './views/Landing.jsx'
import StudentView from './views/StudentView.jsx'
import AdminView from './views/AdminView.jsx'
import TeacherView from './views/TeacherView.jsx'
import Help from './views/Help.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/s/:code/student" element={<StudentView />} />
        <Route path="/s/:code/admin" element={<AdminView />} />
        <Route path="/s/:code/teacher" element={<TeacherView />} />
        <Route path="/help" element={<Help />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
