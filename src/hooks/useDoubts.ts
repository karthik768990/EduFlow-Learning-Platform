import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Doubt {
  id: string;
  question: string;
  student_id: string;
  assignment_id: string;
  created_at: string;
  assignment?: { title: string };
  student?: { full_name: string; avatar_url: string | null };
  replies: Reply[];
}

interface Reply {
  id: string;
  reply: string;
  teacher_id: string;
  created_at: string;
  teacher?: { full_name: string; avatar_url: string | null };
}

export function useDoubts() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ['doubts', user?.id, role];

  const doubtsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase.from('doubts').select('*').order('created_at', { ascending: false });
      
      if (role === 'student') {
        query = query.eq('student_id', user!.id);
      }
      
      const { data: doubtsData, error } = await query;
      
      if (error) throw error;
      if (!doubtsData || doubtsData.length === 0) return [];
      
      const assignmentIds = [...new Set(doubtsData.map(d => d.assignment_id))];
      const studentIds = [...new Set(doubtsData.map(d => d.student_id))];
      const doubtIds = doubtsData.map(d => d.id);
      
      const [assignmentsRes, studentsRes, repliesRes] = await Promise.all([
        supabase.from('assignments').select('id, title').in('id', assignmentIds),
        supabase.from('profiles').select('id, full_name, avatar_url').in('id', studentIds),
        supabase.from('doubt_replies').select('*').in('doubt_id', doubtIds).order('created_at', { ascending: true })
      ]);
      
      const teacherIds = [...new Set((repliesRes.data || []).map(r => r.teacher_id))];
      const teachersRes = teacherIds.length > 0 
        ? await supabase.from('profiles').select('id, full_name, avatar_url').in('id', teacherIds)
        : { data: [] };
      
      const enrichedDoubts: Doubt[] = doubtsData.map(doubt => {
        const assignment = assignmentsRes.data?.find(a => a.id === doubt.assignment_id);
        const student = studentsRes.data?.find(s => s.id === doubt.student_id);
        const replies = (repliesRes.data || [])
          .filter(r => r.doubt_id === doubt.id)
          .map(reply => ({
            ...reply,
            teacher: teachersRes.data?.find(t => t.id === reply.teacher_id)
          }));
        
        return {
          ...doubt,
          assignment: assignment ? { title: assignment.title } : undefined,
          student: student ? { full_name: student.full_name || 'Student', avatar_url: student.avatar_url } : undefined,
          replies
        };
      });
      
      return enrichedDoubts;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const assignmentsQuery = useQuery({
    queryKey: ['assignments-for-doubts', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('assignments')
        .select('id, title')
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user && role === 'student',
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const createDoubtMutation = useMutation({
    mutationFn: async ({ assignment_id, question }: { assignment_id: string; question: string }) => {
      const { data, error } = await supabase.from('doubts').insert({
        student_id: user!.id,
        assignment_id,
        question: question.trim()
      }).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ assignment_id, question }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousDoubts = queryClient.getQueryData<Doubt[]>(queryKey);
      
      const assignment = assignmentsQuery.data?.find(a => a.id === assignment_id);
      const optimisticDoubt: Doubt = {
        id: `temp-${Date.now()}`,
        question: question.trim(),
        student_id: user!.id,
        assignment_id,
        created_at: new Date().toISOString(),
        assignment: assignment ? { title: assignment.title } : undefined,
        student: { full_name: user?.user_metadata?.full_name || 'You', avatar_url: null },
        replies: []
      };
      
      queryClient.setQueryData<Doubt[]>(queryKey, (old) => [optimisticDoubt, ...(old || [])]);
      return { previousDoubts };
    },
    onError: (err, variables, context) => {
      if (context?.previousDoubts) {
        queryClient.setQueryData(queryKey, context.previousDoubts);
      }
      toast({ title: 'Error', description: 'Failed to submit question', variant: 'destructive' });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Your question has been submitted!' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    }
  });

  const deleteDoubtMutation = useMutation({
    mutationFn: async (doubtId: string) => {
      const { error } = await supabase.from('doubts').delete().eq('id', doubtId);
      if (error) throw error;
      return doubtId;
    },
    onMutate: async (doubtId) => {
      await queryClient.cancelQueries({ queryKey });
      const previousDoubts = queryClient.getQueryData<Doubt[]>(queryKey);
      
      queryClient.setQueryData<Doubt[]>(queryKey, (old) => 
        (old || []).filter(d => d.id !== doubtId)
      );
      return { previousDoubts };
    },
    onError: (err, doubtId, context) => {
      if (context?.previousDoubts) {
        queryClient.setQueryData(queryKey, context.previousDoubts);
      }
      toast({ title: 'Error', description: 'Failed to delete question', variant: 'destructive' });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Question deleted' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    }
  });

  const replyMutation = useMutation({
    mutationFn: async ({ doubtId, reply }: { doubtId: string; reply: string }) => {
      const { data, error } = await supabase.from('doubt_replies').insert({
        doubt_id: doubtId,
        teacher_id: user!.id,
        reply: reply.trim()
      }).select().single();
      if (error) throw error;
      return { doubtId, replyData: data };
    },
    onMutate: async ({ doubtId, reply }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousDoubts = queryClient.getQueryData<Doubt[]>(queryKey);
      
      const optimisticReply: Reply = {
        id: `temp-${Date.now()}`,
        reply: reply.trim(),
        teacher_id: user!.id,
        created_at: new Date().toISOString(),
        teacher: { full_name: user?.user_metadata?.full_name || 'You', avatar_url: null }
      };
      
      queryClient.setQueryData<Doubt[]>(queryKey, (old) => 
        (old || []).map(d => 
          d.id === doubtId 
            ? { ...d, replies: [...d.replies, optimisticReply] }
            : d
        )
      );
      return { previousDoubts };
    },
    onError: (err, variables, context) => {
      if (context?.previousDoubts) {
        queryClient.setQueryData(queryKey, context.previousDoubts);
      }
      toast({ title: 'Error', description: 'Failed to send reply', variant: 'destructive' });
    },
    onSuccess: async ({ doubtId }) => {
      toast({ title: 'Success', description: 'Reply sent!' });
      
      // Send email notification in background
      const doubt = doubtsQuery.data?.find(d => d.id === doubtId);
      if (doubt) {
        const { data: studentProfile } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', doubt.student_id)
          .single();
        
        const { data: teacherProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user!.id)
          .single();
        
        if (studentProfile?.email) {
          supabase.functions.invoke('send-reply-notification', {
            body: {
              studentEmail: studentProfile.email,
              studentName: studentProfile.full_name || 'Student',
              teacherName: teacherProfile?.full_name || 'Your teacher',
              assignmentTitle: doubt.assignment?.title || 'Assignment',
              question: doubt.question,
              reply: doubt.replies[doubt.replies.length - 1]?.reply || ''
            }
          }).catch(console.error);
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    }
  });

  return {
    doubts: doubtsQuery.data || [],
    assignments: assignmentsQuery.data || [],
    isLoading: doubtsQuery.isLoading,
    createDoubt: createDoubtMutation.mutateAsync,
    deleteDoubt: deleteDoubtMutation.mutateAsync,
    sendReply: replyMutation.mutateAsync,
    isSubmitting: createDoubtMutation.isPending || deleteDoubtMutation.isPending || replyMutation.isPending,
    refetch: doubtsQuery.refetch
  };
}
