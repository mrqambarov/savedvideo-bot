import { Routes, Route, Navigate } from 'react-router-dom';
import { useApp } from './context/AppContext.jsx';
import { ToastHost } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Analytics from './pages/Analytics.jsx';
import Movies from './pages/Movies.jsx';
import Serials from './pages/Serials.jsx';
import Requests from './pages/Requests.jsx';
import Users from './pages/Users.jsx';
import Broadcast from './pages/Broadcast.jsx';
import Channels from './pages/Channels.jsx';
import Referrals from './pages/Referrals.jsx';
import Downloader from './pages/Downloader.jsx';
import MovieBot from './pages/MovieBot.jsx';
import SettingsPage from './pages/Settings.jsx';
import AiPublisher from './pages/AiPublisher.jsx';
import AdultBotPage from './pages/AdultBot.jsx';

export default function App() {
  const { authed } = useApp();

  if (!authed) {
    return (
      <>
        <Login />
        <ToastHost />
      </>
    );
  }

  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/users" element={<Users />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/serials" element={<Serials />} />
          <Route path="/ai-publisher" element={<AiPublisher />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/broadcast" element={<Broadcast />} />
          <Route path="/channels" element={<Channels />} />
          <Route path="/referrals" element={<Referrals />} />
          <Route path="/downloader" element={<Downloader />} />
          <Route path="/movie-bot" element={<MovieBot />} />
          <Route path="/adult-bot" element={<AdultBotPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <ToastHost />
    </>
  );
}
