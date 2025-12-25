import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, GraduationCap, Users, Mail, Lock, Eye, EyeOff, Sparkles, Target, TrendingUp } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import styles from '@/styles/pages/Auth.module.css';

const emailSchema = z.string().trim().email('Please enter a valid email address');

const formVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 }
};

const contentVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 }
};
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

export default function Auth() {
  const { user, role, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, setUserRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<'student' | 'teacher' | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  if (loading) {
    return (
      <div className={styles.authContainer}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (user && role) {
    return <Navigate to="/dashboard" replace />;
  }

  const validateFields = () => {
    const errors: { email?: string; password?: string } = {};
    
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      errors.email = emailResult.error.errors[0].message;
    }
    
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      errors.password = passwordResult.error.errors[0].message;
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getErrorMessage = (error: any): string => {
    const message = error?.message?.toLowerCase() || '';
    
    if (message.includes('invalid login credentials')) {
      return 'Invalid email or password. Please try again.';
    }
    if (message.includes('user already registered')) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    if (message.includes('email not confirmed')) {
      return 'Please check your email and confirm your account before signing in.';
    }
    if (message.includes('too many requests')) {
      return 'Too many attempts. Please wait a moment and try again.';
    }
    if (message.includes('network')) {
      return 'Network error. Please check your connection and try again.';
    }
    
    return error?.message || 'Something went wrong. Please try again.';
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateFields()) return;
    
    setIsLoading(true);
    try {
      const { error } = isSignUp 
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);
      
      if (error) {
        setError(getErrorMessage(error));
      } else if (isSignUp) {
        setError('');
        setIsSignUp(false);
        setEmail('');
        setPassword('');
        // Show success message for signup
        setError('Account created! You can now sign in.');
      }
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
      setIsLoading(false);
    }
  };

  const handleRoleSelection = async () => {
    if (!selectedRole) return;
    setIsLoading(true);
    try {
      await setUserRole(selectedRole);
    } catch (err: any) {
      setError(err.message || 'Failed to set role');
      setIsLoading(false);
    }
  };

  if (user && !role) {
    return (
      <div className={styles.authContainer}>
        <div className={styles.heroSection}>
          <div className={styles.heroContent}>
            <motion.div 
              className={styles.heroLogo}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className={styles.logoIcon}><BookOpen size={28} /></div>
              <span className={styles.logoText}>EduFlow</span>
            </motion.div>
            <motion.h1 
              className={styles.heroTitle}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Almost there!
            </motion.h1>
            <motion.p 
              className={styles.heroSubtitle}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Choose your role to personalize your experience
            </motion.p>
          </div>
          <div className={styles.heroPattern} />
        </div>
        
        <div className={styles.formSection}>
          <motion.div 
            className={styles.formCard}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>Choose Your Role</h2>
              <p className={styles.formSubtitle}>Select how you'll use EduFlow</p>
            </div>
            
            <div className={styles.formContent}>
              {error && <div className={styles.errorMessage}>{error}</div>}
              
              <div className={styles.roleOptions}>
                <motion.div 
                  className={`${styles.roleOption} ${selectedRole === 'student' ? styles.selected : ''}`}
                  onClick={() => setSelectedRole('student')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <GraduationCap className={styles.roleIcon} />
                  <div className={styles.roleName}>Student</div>
                  <div className={styles.roleDesc}>Complete assignments & track progress</div>
                </motion.div>
                
                <motion.div 
                  className={`${styles.roleOption} ${selectedRole === 'teacher' ? styles.selected : ''}`}
                  onClick={() => setSelectedRole('teacher')}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Users className={styles.roleIcon} />
                  <div className={styles.roleName}>Teacher</div>
                  <div className={styles.roleDesc}>Create assignments & mentor students</div>
                </motion.div>
              </div>
              
              <button 
                className={styles.primaryButton} 
                onClick={handleRoleSelection}
                disabled={!selectedRole || isLoading}
              >
                {isLoading ? <div className={styles.spinner} /> : 'Continue'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.authContainer}>
      {/* Hero Section */}
      <div className={styles.heroSection}>
        <div className={styles.heroContent}>
          <motion.div 
            className={styles.heroLogo}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className={styles.logoIcon}><BookOpen size={28} /></div>
            <span className={styles.logoText}>EduFlow</span>
          </motion.div>
          
          <motion.h1 
            className={styles.heroTitle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            Master Your Learning Journey
          </motion.h1>
          
          <motion.p 
            className={styles.heroSubtitle}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Track progress, complete assignments, and achieve your goals with our intuitive learning platform.
          </motion.p>
          
          <motion.div 
            className={styles.heroFeatures}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className={styles.heroFeature}>
              <div className={styles.featureIcon}><Sparkles size={20} /></div>
              <span>Gamified Learning</span>
            </div>
            <div className={styles.heroFeature}>
              <div className={styles.featureIcon}><Target size={20} /></div>
              <span>Track Assignments</span>
            </div>
            <div className={styles.heroFeature}>
              <div className={styles.featureIcon}><TrendingUp size={20} /></div>
              <span>Compete on Leaderboards</span>
            </div>
          </motion.div>
        </div>
        <div className={styles.heroPattern} />
      </div>
      
      {/* Form Section */}
      <div className={styles.formSection}>
        <motion.div 
          className={styles.formCard}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={isSignUp ? 'signup-header' : 'signin-header'}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
              className={styles.formHeader}
            >
              <h2 className={styles.formTitle}>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
              <p className={styles.formSubtitle}>
                {isSignUp ? 'Sign up to start your learning journey' : 'Sign in to continue learning'}
              </p>
            </motion.div>
          </AnimatePresence>
          
          <div className={styles.formContent}>
            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  key="error-message"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className={error.includes('created') ? styles.successMessage : styles.errorMessage}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
            
            <AnimatePresence mode="wait">
              <motion.form 
                key={isSignUp ? 'signup-form' : 'signin-form'}
                variants={formVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                onSubmit={handleEmailAuth} 
                className={styles.form}
              >
                <motion.div 
                  className={styles.inputGroup}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                >
                  <label htmlFor="email" className={styles.inputLabel}>Email</label>
                  <div className={styles.inputWrapper}>
                    <Mail className={styles.inputIcon} size={18} />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: undefined }));
                      }}
                      placeholder="you@example.com"
                      className={`${styles.input} ${fieldErrors.email ? styles.inputError : ''}`}
                      disabled={isLoading}
                    />
                  </div>
                  {fieldErrors.email && <span className={styles.fieldError}>{fieldErrors.email}</span>}
                </motion.div>
                
                <motion.div 
                  className={styles.inputGroup}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <label htmlFor="password" className={styles.inputLabel}>Password</label>
                  <div className={styles.inputWrapper}>
                    <Lock className={styles.inputIcon} size={18} />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (fieldErrors.password) setFieldErrors(prev => ({ ...prev, password: undefined }));
                      }}
                      placeholder="••••••••"
                      className={`${styles.input} ${fieldErrors.password ? styles.inputError : ''}`}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      className={styles.passwordToggle}
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {fieldErrors.password && <span className={styles.fieldError}>{fieldErrors.password}</span>}
                </motion.div>
                
                <motion.button 
                  type="submit"
                  className={styles.primaryButton} 
                  disabled={isLoading}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                >
                  {isLoading ? <div className={styles.spinner} /> : (isSignUp ? 'Sign Up' : 'Sign In')}
                </motion.button>
              </motion.form>
            </AnimatePresence>
            
            <div className={styles.divider}>
              <span className={styles.dividerLine}></span>
              <span className={styles.dividerText}>or</span>
              <span className={styles.dividerLine}></span>
            </div>
            
            <motion.button 
              className={styles.googleButton} 
              onClick={handleGoogleLogin}
              disabled={isLoading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
            >
              <svg className={styles.googleIcon} viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </motion.button>
            
            <AnimatePresence mode="wait">
              <motion.div 
                key={isSignUp ? 'toggle-signin' : 'toggle-signup'}
                className={styles.toggleAuth}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <span className={styles.toggleText}>
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                </span>
                <button 
                  type="button"
                  className={styles.toggleButton}
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                    setFieldErrors({});
                  }}
                >
                  {isSignUp ? 'Sign In' : 'Sign Up'}
                </button>
              </motion.div>
            </AnimatePresence>
          </div>
          
          <div className={styles.formFooter}>
            <p className={styles.footerText}>
              By signing in, you agree to our Terms of Service
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}