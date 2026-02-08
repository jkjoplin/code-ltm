import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import LearningPage from "./pages/LearningPage";
import SettingsPage from "./pages/SettingsPage";
import PromotionPage from "./pages/PromotionPage";
import GraphPage from "./pages/GraphPage";
import AutonomyPage from "./pages/AutonomyPage";

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/learning/:id" element={<LearningPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/promote" element={<PromotionPage />} />
        <Route path="/autonomy" element={<AutonomyPage />} />
        <Route path="/graph" element={<GraphPage />} />
        <Route path="/graph/:id" element={<GraphPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
