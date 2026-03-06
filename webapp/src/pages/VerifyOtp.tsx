import { Navigate } from "react-router-dom";

// OTP verification is no longer used - redirect to login
export default function VerifyOtp() {
  return <Navigate to="/login" replace />;
}
