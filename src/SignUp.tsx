import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "./components/AuthLayout";
import { supabase } from "./supabase";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const { data, error: supabaseError } = await supabase.auth.signUp({
        email,
        password,
      });
      
      if (supabaseError) {
        setError(supabaseError.message);
      } else {
        setSuccess("Account created successfully! Redirecting...");
        setTimeout(() => navigate("/login"), 1500);
      }
    } catch (err) {
      setError("An error occurred connecting to the server.");
    }
  };

  return (
    <AuthLayout>
      <h1 className="auth-title">SIGN UP</h1>
      <p className="auth-subtitle">Welcome</p>

      <form onSubmit={handleSignUp}>
        <label htmlFor="email">Email :</label>
        <input 
          type="email" 
          id="email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required 
        />

        <label htmlFor="password">Password :</label>
        <div className="password-container">
          <input 
            type={showPassword ? "text" : "password"} 
            id="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
          <button 
            type="button" 
            className="password-toggle"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        <label htmlFor="confirmPassword">Confirm Password :</label>
        <div className="password-container">
          <input 
            type={showConfirmPassword ? "text" : "password"} 
            id="confirmPassword" 
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required 
          />
          <button 
            type="button" 
            className="password-toggle"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {error && <p style={{ color: "#ef4444", fontSize: "14px", marginBottom: "10px" }}>{error}</p>}
        {success && <p style={{ color: "#22c55e", fontSize: "14px", marginBottom: "10px" }}>{success}</p>}

        <button type="submit" className="primary-btn">SIGN UP</button>
      </form>

      <div className="auth-footer">
        Have an account? <Link to="/login">Log In</Link>
      </div>
    </AuthLayout>
  );
}
