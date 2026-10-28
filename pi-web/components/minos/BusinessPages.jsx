'use client'
import { useEffect } from 'react'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import Knowledge from './pages/Knowledge.jsx'
import CollegePage from './pages/CollegePage.jsx'
import MajorPage from './pages/MajorPage.jsx'
import ChapterReader from './pages/ChapterReader.jsx'
import Interview from './pages/Interview.jsx'
import InterviewRoom from './pages/InterviewRoom.jsx'
import Review from './pages/Review.jsx'
import Onboarding from './pages/Onboarding.jsx'
import LearningReview from './pages/LearningReview.jsx'
import './styles/pages.css'
import './styles/pi-knowledge.css'
import './styles/business.css'

function Content({ path, onNavigate }) {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => { if (location.pathname !== path) navigate(path, { replace: true }) }, [path])
  useEffect(() => { if (location.pathname !== path) onNavigate(location.pathname) }, [location.pathname])
  return <Routes>
    <Route path="/knowledge" element={<Knowledge />} />
    <Route path="/knowledge/college/:cid" element={<CollegePage />} />
    <Route path="/knowledge/major/:mid" element={<MajorPage />} />
    <Route path="/guide/:id" element={<ChapterReader />} />
    <Route path="/interview" element={<Interview />} />
    <Route path="/interview/room" element={<InterviewRoom />} />
    <Route path="/review" element={<LearningReview />} />
    <Route path="/admin/review" element={<Review />} />
    <Route path="/onboarding" element={<Onboarding />} />
  </Routes>
}
export default function BusinessPages({ path, onNavigate }) {
  return <div className="minos-native"><MemoryRouter initialEntries={[path]}><Content path={path} onNavigate={onNavigate} /></MemoryRouter></div>
}
