import { Navigate } from 'react-router-dom'

export default function BottleNewPage() {
  return <Navigate to="/buy?cat=bottle" replace />
}
