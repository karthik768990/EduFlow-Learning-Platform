import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const ACHIEVEMENTS = [
  { key: 'first_assignment', title: 'First Steps', requirement: 1, type: 'assignments' },
  { key: 'assignments_5', title: 'Getting Started', requirement: 5, type: 'assignments' },
  { key: 'assignments_10', title: 'Dedicated Learner', requirement: 10, type: 'assignments' },
  { key: 'study_1h', title: 'Time Well Spent', requirement: 1, type: 'study_hours' },
  { key: 'study_5h', title: 'Focused Mind', requirement: 5, type: 'study_hours' },
  { key: 'study_10h', title: 'Study Champion', requirement: 10, type: 'study_hours' },
];

export function useDashboard() {
  const { user, role } = useAuth();

  const profileQuery = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user!.id)
        .maybeSingle();
      return data?.full_name || null;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const studentStatsQuery = useQuery({
    queryKey: ['student-stats', user?.id],
    queryFn: async () => {
      const [assignmentsRes, submissionsRes, sessionsRes] = await Promise.all([
        supabase.from('assignments').select('id', { count: 'exact' }),
        supabase.from('submissions').select('id', { count: 'exact' }).eq('student_id', user!.id),
        supabase.from('study_sessions').select('start_time, end_time').eq('user_id', user!.id).not('end_time', 'is', null)
      ]);

      const totalMinutes = (sessionsRes.data || []).reduce((acc, s) => {
        const start = new Date(s.start_time).getTime();
        const end = new Date(s.end_time!).getTime();
        return acc + (end - start) / 60000;
      }, 0);

      return {
        assignments: assignmentsRes.count || 0,
        completed: submissionsRes.count || 0,
        studyTime: Math.round(totalMinutes),
        rank: 1
      };
    },
    enabled: !!user && role === 'student',
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const teacherStatsQuery = useQuery({
    queryKey: ['teacher-stats', user?.id],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count: assignmentsCount } = await supabase
        .from('assignments')
        .select('id', { count: 'exact' })
        .eq('teacher_id', user!.id);

      const { data: allDoubts } = await supabase.from('doubts').select('id');
      const { data: repliedDoubts } = await supabase.from('doubt_replies').select('doubt_id');

      const repliedDoubtIds = new Set(repliedDoubts?.map(r => r.doubt_id) || []);
      const pendingDoubtsCount = (allDoubts || []).filter(d => !repliedDoubtIds.has(d.id)).length;

      const { count: todaySubmissionsCount } = await supabase
        .from('submissions')
        .select('id', { count: 'exact' })
        .gte('completed_at', today.toISOString());

      const { data: submissions } = await supabase.from('submissions').select('student_id');
      const uniqueStudents = new Set(submissions?.map(s => s.student_id) || []);

      return {
        totalAssignments: assignmentsCount || 0,
        pendingDoubts: pendingDoubtsCount,
        todaySubmissions: todaySubmissionsCount || 0,
        totalStudents: uniqueStudents.size
      };
    },
    enabled: !!user && role === 'teacher',
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const weeklyDataQuery = useQuery({
    queryKey: ['weekly-data', user?.id],
    queryFn: async () => {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const today = new Date();
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      weekAgo.setHours(0, 0, 0, 0);

      const { data: sessions } = await supabase
        .from('study_sessions')
        .select('start_time, end_time')
        .eq('user_id', user!.id)
        .not('end_time', 'is', null)
        .gte('start_time', weekAgo.toISOString())
        .lte('start_time', today.toISOString());

      const weekData: { [key: number]: number } = {};
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (6 - i));
        weekData[date.getDay()] = 0;
      }

      (sessions || []).forEach(session => {
        const startDate = new Date(session.start_time);
        const endDate = new Date(session.end_time!);
        const dayOfWeek = startDate.getDay();
        const hours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
        weekData[dayOfWeek] = (weekData[dayOfWeek] || 0) + hours;
      });

      const orderedData = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - (6 - i));
        const dayIndex = date.getDay();
        orderedData.push({
          day: days[dayIndex],
          hours: Math.round(weekData[dayIndex] * 100) / 100
        });
      }

      return orderedData;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const leaderboardQuery = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const { data: submissions } = await supabase.from('submissions').select('student_id');
      
      if (!submissions || submissions.length === 0) return [];

      const counts: Record<string, number> = {};
      submissions.forEach(s => {
        counts[s.student_id] = (counts[s.student_id] || 0) + 1;
      });

      const topStudentIds = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id]) => id);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', topStudentIds);

      return topStudentIds.map(studentId => {
        const profile = profiles?.find(p => p.id === studentId);
        return {
          id: studentId,
          full_name: profile?.full_name || 'Student',
          avatar_url: profile?.avatar_url,
          count: counts[studentId]
        };
      });
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const achievementsQuery = useQuery({
    queryKey: ['achievements', user?.id],
    queryFn: async () => {
      const { data: achievements } = await supabase
        .from('user_achievements')
        .select('achievement_key, earned_at')
        .eq('user_id', user!.id)
        .order('earned_at', { ascending: false });
      
      const earnedKeys = (achievements || []).map(a => a.achievement_key);
      
      const [submissionsRes, sessionsRes] = await Promise.all([
        supabase.from('submissions').select('id').eq('student_id', user!.id),
        supabase.from('study_sessions').select('start_time, end_time').eq('user_id', user!.id).not('end_time', 'is', null)
      ]);
      
      const completedAssignments = submissionsRes.data?.length || 0;
      const studyMinutes = (sessionsRes.data || []).reduce((acc, s) => {
        return acc + (new Date(s.end_time!).getTime() - new Date(s.start_time).getTime()) / 60000;
      }, 0);
      const studyHours = studyMinutes / 60;
      
      const unlockedAchievements = ACHIEVEMENTS.filter(a => !earnedKeys.includes(a.key));
      let nextAchievement = null;
      let achievementProgress = 0;
      
      if (unlockedAchievements.length > 0) {
        const sorted = unlockedAchievements.map(a => {
          const current = a.type === 'assignments' ? completedAssignments : studyHours;
          const progress = Math.min(100, (current / a.requirement) * 100);
          return { ...a, progress, current };
        }).sort((a, b) => b.progress - a.progress);
        
        nextAchievement = sorted[0];
        achievementProgress = sorted[0].progress;
      }

      return { earnedKeys, nextAchievement, achievementProgress };
    },
    enabled: !!user && role === 'student',
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const recentActivityQuery = useQuery({
    queryKey: ['recent-activity', user?.id],
    queryFn: async () => {
      const { data: submissions } = await supabase
        .from('submissions')
        .select('id, student_id, assignment_id, completed_at')
        .order('completed_at', { ascending: false })
        .limit(10);

      const { data: doubts } = await supabase
        .from('doubts')
        .select('id, student_id, assignment_id, created_at, question')
        .order('created_at', { ascending: false })
        .limit(10);

      const studentIds = new Set<string>();
      const assignmentIds = new Set<string>();
      
      submissions?.forEach(s => {
        studentIds.add(s.student_id);
        assignmentIds.add(s.assignment_id);
      });
      doubts?.forEach(d => {
        studentIds.add(d.student_id);
        assignmentIds.add(d.assignment_id);
      });

      const [profilesRes, assignmentsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', Array.from(studentIds)),
        supabase.from('assignments').select('id, title').in('id', Array.from(assignmentIds))
      ]);

      const profilesMap = new Map(profilesRes.data?.map(p => [p.id, p.full_name || 'Student']) || []);
      const assignmentsMap = new Map(assignmentsRes.data?.map(a => [a.id, a.title]) || []);

      const activities = [
        ...(submissions?.map(s => ({
          id: s.id,
          type: 'submission' as const,
          studentName: profilesMap.get(s.student_id) || 'Student',
          title: assignmentsMap.get(s.assignment_id) || 'Assignment',
          timestamp: s.completed_at
        })) || []),
        ...(doubts?.map(d => ({
          id: d.id,
          type: 'doubt' as const,
          studentName: profilesMap.get(d.student_id) || 'Student',
          title: d.question.substring(0, 50) + (d.question.length > 50 ? '...' : ''),
          timestamp: d.created_at
        })) || [])
      ];

      activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      return activities.slice(0, 5);
    },
    enabled: !!user && role === 'teacher',
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    profileName: profileQuery.data,
    studentStats: studentStatsQuery.data || { assignments: 0, completed: 0, studyTime: 0, rank: 0 },
    teacherStats: teacherStatsQuery.data || { totalAssignments: 0, pendingDoubts: 0, todaySubmissions: 0, totalStudents: 0 },
    weeklyData: weeklyDataQuery.data || [],
    leaderboard: leaderboardQuery.data || [],
    achievements: achievementsQuery.data || { earnedKeys: [], nextAchievement: null, achievementProgress: 0 },
    recentActivity: recentActivityQuery.data || [],
    isLoading: profileQuery.isLoading || studentStatsQuery.isLoading || teacherStatsQuery.isLoading,
    refetchTeacherStats: teacherStatsQuery.refetch,
    refetchRecentActivity: recentActivityQuery.refetch,
    refetchLeaderboard: leaderboardQuery.refetch,
  };
}
