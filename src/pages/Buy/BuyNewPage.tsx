import { Navigate } from 'react-router-dom'

/** Purchase form lives on /buy — keep old link working. */
export default function BuyNewPage() {
  return <Navigate to="/buy" replace />
}
