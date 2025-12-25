import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Trophy, Target, Clock, BookOpen, Flame, Star, 
  Award, Zap, Crown, Medal, CheckCircle, Lock
} from 'lucide-react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import styles from '@/styles/pages/Achievements.module.css';

interface Achievement {
  key: string;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
  requirement: number;
  type: 'assignments' | 'study_hours' | 'streak';
}

const ACHIEVEMENTS: Achievement[] = [
  // Assignment milestones
  { key: 'first_assignment', title: 'First Steps', description: 'Complete your first assignment', icon: CheckCircle, color: '#22c55e', requirement: 1, type: 'assignments' },
  { key: 'assignments_5', title: 'Getting Started', description: 'Complete 5 assignments', icon: Target, color: '#3b82f6', requirement: 5, type: 'assignments' },
  { key: 'assignments_10', title: 'Dedicated Learner', description: 'Complete 10 assignments', icon: BookOpen, color: '#8b5cf6', requirement: 10, type: 'assignments' },
  { key: 'assignments_25', title: 'Knowledge Seeker', description: 'Complete 25 assignments', icon: Star, color: '#f59e0b', requirement: 25, type: 'assignments' },
  { key: 'assignments_50', title: 'Scholar', description: 'Complete 50 assignments', icon: Award, color: '#ec4899', requirement: 50, type: 'assignments' },
  { key: 'assignments_100', title: 'Master Student', description: 'Complete 100 assignments', icon: Crown, color: '#eab308', requirement: 100, type: 'assignments' },
  
  // Study time milestones (in hours)
  { key: 'study_1h', title: 'Time Well Spent', description: 'Study for 1 hour total', icon: Clock, color: '#06b6d4', requirement: 1, type: 'study_hours' },
  { key: 'study_5h', title: 'Focused Mind', description: 'Study for 5 hours total', icon: Zap, color: '#f97316', requirement: 5, type: 'study_hours' },
  { key: 'study_10h', title: 'Study Champion', description: 'Study for 10 hours total', icon: Flame, color: '#ef4444', requirement: 10, type: 'study_hours' },
  { key: 'study_25h', title: 'Dedication Master', description: 'Study for 25 hours total', icon: Trophy, color: '#a855f7', requirement: 25, type: 'study_hours' },
  { key: 'study_50h', title: 'Study Legend', description: 'Study for 50 hours total', icon: Medal, color: '#14b8a6', requirement: 50, type: 'study_hours' },
];

export default function Achievements() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [earnedAchievements, setEarnedAchievements] = useState<string[]>([]);
  const [stats, setStats] = useState({ assignments: 0, studyHours: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch earned achievements
    const { data: achievements } = await supabase
      .from('user_achievements')
      .select('achievement_key')
      .eq('user_id', user!.id);
    
    const earnedKeys = (achievements || []).map(a => a.achievement_key);
    setEarnedAchievements(earnedKeys);
    
    // Fetch stats
    const [submissionsRes, sessionsRes] = await Promise.all([
      supabase.from('submissions').select('id').eq('student_id', user!.id),
      supabase.from('study_sessions').select('start_time, end_time').eq('user_id', user!.id).not('end_time', 'is', null)
    ]);
    
    const assignmentCount = submissionsRes.data?.length || 0;
    const studyMinutes = (sessionsRes.data || []).reduce((acc, s) => {
      return acc + (new Date(s.end_time!).getTime() - new Date(s.start_time).getTime()) / 60000;
    }, 0);
    
    setStats({ assignments: assignmentCount, studyHours: Math.floor(studyMinutes / 60) });
    
    // Check for new achievements to award
    await checkAndAwardAchievements(earnedKeys, assignmentCount, studyMinutes / 60);
    
    setLoading(false);
  };

  const checkAndAwardAchievements = async (
    currentlyEarned: string[], 
    assignments: number, 
    studyHours: number
  ) => {
    const newAchievements: string[] = [];
    
    for (const achievement of ACHIEVEMENTS) {
      if (currentlyEarned.includes(achievement.key)) continue;
      
      let earned = false;
      if (achievement.type === 'assignments' && assignments >= achievement.requirement) {
        earned = true;
      } else if (achievement.type === 'study_hours' && studyHours >= achievement.requirement) {
        earned = true;
      }
      
      if (earned) {
        const { error } = await supabase.from('user_achievements').insert({
          user_id: user!.id,
          achievement_key: achievement.key
        });
        
        if (!error) {
          newAchievements.push(achievement.key);
          toast({
            title: '🎉 Achievement Unlocked!',
            description: `${achievement.title}: ${achievement.description}`,
          });
        }
      }
    }
    
    if (newAchievements.length > 0) {
      setEarnedAchievements(prev => [...prev, ...newAchievements]);
    }
  };

  const getProgress = (achievement: Achievement) => {
    if (achievement.type === 'assignments') {
      return Math.min(100, (stats.assignments / achievement.requirement) * 100);
    } else if (achievement.type === 'study_hours') {
      return Math.min(100, (stats.studyHours / achievement.requirement) * 100);
    }
    return 0;
  };

  const getProgressText = (achievement: Achievement) => {
    if (achievement.type === 'assignments') {
      return `${Math.min(stats.assignments, achievement.requirement)}/${achievement.requirement}`;
    } else if (achievement.type === 'study_hours') {
      return `${Math.min(stats.studyHours, achievement.requirement)}/${achievement.requirement}h`;
    }
    return '';
  };

  const earnedCount = earnedAchievements.length;
  const totalCount = ACHIEVEMENTS.length;

  return (
    <Layout title="Achievements">
      <div className={styles.container}>
        {/* Stats Header */}
        <motion.div 
          className={styles.statsCard}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className={styles.progressCircle}>
            <svg viewBox="0 0 100 100">
              <circle 
                cx="50" cy="50" r="45" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="8"
                className={styles.progressBg}
              />
              <circle 
                cx="50" cy="50" r="45" 
                fill="none" 
                stroke="url(#gradient)" 
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(earnedCount / totalCount) * 283} 283`}
                transform="rotate(-90 50 50)"
                className={styles.progressFill}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div className={styles.progressText}>
              <span className={styles.progressCount}>{earnedCount}</span>
              <span className={styles.progressTotal}>/{totalCount}</span>
            </div>
          </div>
          <div className={styles.statsInfo}>
            <h2>Your Progress</h2>
            <p>{earnedCount} of {totalCount} achievements unlocked</p>
            <div className={styles.quickStats}>
              <div className={styles.quickStat}>
                <CheckCircle size={16} />
                <span>{stats.assignments} assignments</span>
              </div>
              <div className={styles.quickStat}>
                <Clock size={16} />
                <span>{stats.studyHours}h studied</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Achievements Grid */}
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Loading achievements...</p>
          </div>
        ) : (
          <div className={styles.achievementsGrid}>
            {ACHIEVEMENTS.map((achievement, index) => {
              const isEarned = earnedAchievements.includes(achievement.key);
              const progress = getProgress(achievement);
              const Icon = achievement.icon;
              
              return (
                <motion.div
                  key={achievement.key}
                  className={`${styles.achievementCard} ${isEarned ? styles.earned : styles.locked}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div 
                    className={styles.iconWrapper}
                    style={{ 
                      background: isEarned 
                        ? `linear-gradient(135deg, ${achievement.color}, ${achievement.color}80)` 
                        : undefined 
                    }}
                  >
                    {isEarned ? (
                      <Icon size={28} color="white" />
                    ) : (
                      <Lock size={24} />
                    )}
                  </div>
                  
                  <div className={styles.achievementInfo}>
                    <h3 className={styles.achievementTitle}>{achievement.title}</h3>
                    <p className={styles.achievementDesc}>{achievement.description}</p>
                    
                    {!isEarned && (
                      <div className={styles.progressSection}>
                        <div className={styles.progressBar}>
                          <div 
                            className={styles.progressFillBar}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className={styles.progressLabel}>{getProgressText(achievement)}</span>
                      </div>
                    )}
                  </div>
                  
                  {isEarned && (
                    <div className={styles.earnedBadge}>
                      <CheckCircle size={16} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
