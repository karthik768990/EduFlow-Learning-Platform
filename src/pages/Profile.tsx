import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Save, User, Mail, Loader2, Trophy } from 'lucide-react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import styles from '@/styles/pages/Profile.module.css';

// Achievement definitions with priority (higher = better)
const ACHIEVEMENTS: Record<string, { label: string; icon: string; priority: number }> = {
  first_session: { label: 'First Steps', icon: '🎯', priority: 1 },
  hour_milestone: { label: 'Hour Hero', icon: '⏰', priority: 2 },
  streak_3: { label: '3-Day Streak', icon: '🔥', priority: 3 },
  streak_7: { label: 'Week Warrior', icon: '⚡', priority: 4 },
  early_bird: { label: 'Early Bird', icon: '🌅', priority: 5 },
  night_owl: { label: 'Night Owl', icon: '🦉', priority: 6 },
  top_10: { label: 'Top 10', icon: '🏆', priority: 7 },
  assignment_master: { label: 'Assignment Master', icon: '📚', priority: 8 },
  study_champion: { label: 'Study Champion', icon: '👑', priority: 9 },
};

export default function Profile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [highestAchievement, setHighestAchievement] = useState<{ label: string; icon: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchHighestAchievement();
    }
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user!.id)
      .maybeSingle();
    
    if (data) {
      setFullName(data.full_name || '');
      setAvatarUrl(data.avatar_url);
    }
    setLoading(false);
  };

  const fetchHighestAchievement = async () => {
    const { data } = await supabase
      .from('user_achievements')
      .select('achievement_key')
      .eq('user_id', user!.id);
    
    if (data && data.length > 0) {
      // Find the highest priority achievement
      let highest: { label: string; icon: string; priority: number } | null = null;
      data.forEach((item) => {
        const achievement = ACHIEVEMENTS[item.achievement_key];
        if (achievement && (!highest || achievement.priority > highest.priority)) {
          highest = achievement;
        }
      });
      if (highest) {
        setHighestAchievement({ label: highest.label, icon: highest.icon });
      }
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Error', description: 'Please select an image file', variant: 'destructive' });
      return;
    }
    
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Error', description: 'Image must be less than 2MB', variant: 'destructive' });
      return;
    }
    
    setUploading(true);
    
    const fileExt = file.name.split('.').pop();
    const filePath = `${user!.id}/avatar.${fileExt}`;
    
    // Upload file
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });
    
    if (uploadError) {
      toast({ title: 'Error', description: 'Failed to upload avatar', variant: 'destructive' });
      setUploading(false);
      return;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);
    
    // Update profile with new avatar URL (add timestamp to bust cache)
    const newAvatarUrl = `${publicUrl}?t=${Date.now()}`;
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: newAvatarUrl })
      .eq('id', user!.id);
    
    if (updateError) {
      toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
    } else {
      setAvatarUrl(newAvatarUrl);
      toast({ title: 'Success', description: 'Avatar updated!' });
    }
    
    setUploading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim()) {
      toast({ title: 'Required', description: 'Please enter your name', variant: 'destructive' });
      return;
    }
    
    setSaving(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', user!.id);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to update profile', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Profile updated!' });
    }
    
    setSaving(false);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  };

  if (loading) {
    return (
      <Layout title="Profile Settings">
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Loading profile...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Profile Settings">
      <div className={styles.container}>
        <motion.div
          className={styles.card}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Avatar Section */}
          <div className={styles.avatarSection}>
            <div className={styles.avatarContainer}>
              <div 
                className={styles.avatarWrapper}
                onClick={handleAvatarClick}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className={styles.avatar} />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {getInitials(fullName)}
                  </div>
                )}
                <div className={styles.avatarOverlay}>
                  {uploading ? (
                    <Loader2 className={styles.spinIcon} size={24} />
                  ) : (
                    <Camera size={24} />
                  )}
                </div>
              </div>
              {highestAchievement && (
                <motion.div 
                  className={styles.achievementBadge}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                >
                  <span className={styles.achievementIcon}>{highestAchievement.icon}</span>
                  <span className={styles.achievementLabel}>{highestAchievement.label}</span>
                </motion.div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className={styles.fileInput}
            />
            <p className={styles.avatarHint}>Click to upload a new photo</p>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                <User size={16} />
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your name"
                className={styles.input}
                maxLength={100}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>
                <Mail size={16} />
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className={`${styles.input} ${styles.disabled}`}
              />
              <p className={styles.hint}>Email cannot be changed</p>
            </div>

            <button
              type="submit"
              className={styles.saveButton}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className={styles.spinIcon} size={18} />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </Layout>
  );
}
