import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "./components/AuthLayout";
import { supabase } from "./supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (supabaseError) {
        setError(supabaseError.message);
      } else if (data.user) {
        setSuccess("Login successful!");
        localStorage.setItem('user', JSON.stringify(data.user));
        navigate('/chat');
      }
    } catch (err) {
      setError("An error occurred connecting to the server.");
    }
  };

  return (
    <AuthLayout>
      <h1 className="auth-title">LOGIN</h1>
      <p className="auth-subtitle">Welcome back!</p>

      <form onSubmit={handleLogin}>
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

        <div className="auth-links">
          <label>
            <input type="checkbox" /> Remember me
          </label>
          <a href="#">Forgot Password?</a>
        </div>
        
        {error && <p style={{ color: "#ef4444", fontSize: "14px", marginBottom: "10px" }}>{error}</p>}
        {success && <p style={{ color: "#22c55e", fontSize: "14px", marginBottom: "10px" }}>{success}</p>}

        <button type="submit" className="primary-btn">LOG IN</button>
      </form>

      <div className="auth-footer">
        Don't have an account? <Link to="/signup">Sign Up</Link>
      </div>
    </AuthLayout>
  );
}