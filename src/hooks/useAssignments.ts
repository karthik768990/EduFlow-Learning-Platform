import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  teacher_id: string;
  created_at: string;
}

interface Submission {
  id: string;
  assignment_id: string;
  completed_at: string;
  duration_seconds: number;
  reflection: string | null;
}

export function useAssignments() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const assignmentsQuery = useQuery({
    queryKey: ['assignments', user?.id, role],
    queryFn: async () => {
      let query = supabase.from('assignments').select('*').order('due_date', { ascending: true });
      
      if (role === 'teacher') {
        query = query.eq('teacher_id', user!.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const submissionsQuery = useQuery({
    queryKey: ['submissions', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('submissions')
        .select('*')
        .eq('student_id', user!.id);
      return data || [];
    },
    enabled: !!user && role === 'student',
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const createAssignmentMutation = useMutation({
    mutationFn: async (data: { title: string; description: string | null; due_date: string | null }) => {
      const { error } = await supabase.from('assignments').insert({
        ...data,
        teacher_id: user!.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Assignment created' });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create assignment', variant: 'destructive' });
    }
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { title: string; description: string | null; due_date: string | null } }) => {
      const { error } = await supabase.from('assignments').update({
        ...data,
        teacher_id: user!.id
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Assignment updated' });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update assignment', variant: 'destructive' });
    }
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Assignment deleted' });
      queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete assignment', variant: 'destructive' });
    }
  });

  const submitAssignmentMutation = useMutation({
    mutationFn: async ({ assignmentId, reflection }: { assignmentId: string; reflection: string }) => {
      const { error } = await supabase.from('submissions').insert({
        assignment_id: assignmentId,
        student_id: user!.id,
        reflection: reflection.trim(),
        duration_seconds: 0
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Assignment completed!' });
      queryClient.invalidateQueries({ queryKey: ['submissions'] });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to submit assignment', variant: 'destructive' });
    }
  });

  const isCompleted = (assignmentId: string) => {
    return (submissionsQuery.data || []).some(s => s.assignment_id === assignmentId);
  };

  const getSubmission = (assignmentId: string) => {
    return (submissionsQuery.data || []).find(s => s.assignment_id === assignmentId);
  };

  return {
    assignments: assignmentsQuery.data || [],
    submissions: submissionsQuery.data || [],
    isLoading: assignmentsQuery.isLoading,
    createAssignment: createAssignmentMutation.mutateAsync,
    updateAssignment: updateAssignmentMutation.mutateAsync,
    deleteAssignment: deleteAssignmentMutation.mutateAsync,
    submitAssignment: submitAssignmentMutation.mutateAsync,
    isSubmitting: createAssignmentMutation.isPending || updateAssignmentMutation.isPending || deleteAssignmentMutation.isPending || submitAssignmentMutation.isPending,
    isCompleted,
    getSubmission,
    refetch: assignmentsQuery.refetch
  };
}
