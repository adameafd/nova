import { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import novaLogo from './assets/nova.png';

import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';

/* Public pages */
import Home from './pages/public/Home';
import About from './pages/public/About';
import Contact from './pages/public/Contact';
import Login from './pages/public/Login';

/* Admin pages */
import AdminAccueil from './pages/admin/Accueil';
import AdminDashboard from './pages/admin/Dashboard';
import AdminAlerts from './pages/admin/Alerts';
import AdminInterventions from './pages/admin/Interventions';
import AdminMessagerie from './pages/admin/Messagerie';
import AdminStock from './pages/admin/Stock';
import AdminUsers from './pages/admin/Users';
import AdminControlUnit from './pages/admin/ControlUnit';
import AdminCompteRendu from './pages/admin/CompteRendu';

/* Tech pages */
import TechAccueil from './pages/tech/Accueil';
import TechAlerts from './pages/tech/Alerts';
import TechInterventions from './pages/tech/Interventions';
import TechMessagerie from './pages/tech/Messagerie';
import TechStock from './pages/tech/Stock';
import TechControlUnit from './pages/tech/ControlUnit';

/* Data pages */
import DataAccueil from './pages/data/Accueil';
import DataDashboard from './pages/data/Dashboard';
import DataCompteRendu from './pages/data/CompteRendu';
import DataMessagerie from './pages/data/Messagerie';

function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function LogoutOverlay() {
  const { loggingOut, finishLogout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loggingOut) return;
    const timer = setTimeout(() => {
      finishLogout();
      navigate('/', { replace: true });
    }, 2500);
    return () => clearTimeout(timer);
  }, [loggingOut, finishLogout, navigate]);

  if (!loggingOut) return null;

  return (
    <div className="logout-overlay active">
      <img src={novaLogo} alt="Logo NOVA" className="logout-logo" />
    </div>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Route>
        <Route path="/login" element={<Login />} />

        {/* Admin routes */}
        <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><Layout role="admin" /></ProtectedRoute>}>
          <Route index element={<AdminAccueil />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="alerts" element={<AdminAlerts />} />
          <Route path="interventions" element={<AdminInterventions />} />
          <Route path="messagerie" element={<AdminMessagerie />} />
          <Route path="stock" element={<AdminStock />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="compte-rendu" element={<AdminCompteRendu />} />
          <Route path="control-unit" element={<AdminControlUnit />} />
        </Route>

        {/* Tech routes */}
        <Route path="/tech" element={<ProtectedRoute allowedRoles={["tech", "technicien"]}><Layout role="tech" /></ProtectedRoute>}>
          <Route index element={<TechAccueil />} />
          <Route path="alerts" element={<TechAlerts />} />
          <Route path="interventions" element={<TechInterventions />} />
          <Route path="messagerie" element={<TechMessagerie />} />
          <Route path="stock" element={<TechStock />} />
          <Route path="control-unit" element={<TechControlUnit />} />
        </Route>

        {/* Data routes */}
        <Route path="/data" element={<ProtectedRoute allowedRoles={["data"]}><Layout role="data" /></ProtectedRoute>}>
          <Route index element={<DataAccueil />} />
          <Route path="dashboard" element={<DataDashboard />} />
          <Route path="compte-rendu" element={<DataCompteRendu />} />
          <Route path="messagerie" element={<DataMessagerie />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <LogoutOverlay />
    </>
  );
}
