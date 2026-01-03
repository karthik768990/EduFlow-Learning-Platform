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

  const assignmentsKey = ['assignments', user?.id, role];
  const submissionsKey = ['submissions', user?.id];

  const assignmentsQuery = useQuery({
    queryKey: assignmentsKey,
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
    queryKey: submissionsKey,
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
      const { data: newAssignment, error } = await supabase.from('assignments').insert({
        ...data,
        teacher_id: user!.id
      }).select().single();
      if (error) throw error;
      return newAssignment;
    },
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: assignmentsKey });
      const previousAssignments = queryClient.getQueryData<Assignment[]>(assignmentsKey);
      
      const optimisticAssignment: Assignment = {
        id: `temp-${Date.now()}`,
        title: data.title,
        description: data.description,
        due_date: data.due_date,
        teacher_id: user!.id,
        created_at: new Date().toISOString()
      };
      
      queryClient.setQueryData<Assignment[]>(assignmentsKey, (old) => [...(old || []), optimisticAssignment]);
      return { previousAssignments };
    },
    onError: (err, variables, context) => {
      if (context?.previousAssignments) {
        queryClient.setQueryData(assignmentsKey, context.previousAssignments);
      }
      toast({ title: 'Error', description: 'Failed to create assignment', variant: 'destructive' });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Assignment created' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: assignmentsKey });
    }
  });

  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { title: string; description: string | null; due_date: string | null } }) => {
      const { error } = await supabase.from('assignments').update({
        ...data,
        teacher_id: user!.id
      }).eq('id', id);
      if (error) throw error;
      return { id, data };
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: assignmentsKey });
      const previousAssignments = queryClient.getQueryData<Assignment[]>(assignmentsKey);
      
      queryClient.setQueryData<Assignment[]>(assignmentsKey, (old) => 
        (old || []).map(a => a.id === id ? { ...a, ...data } : a)
      );
      return { previousAssignments };
    },
    onError: (err, variables, context) => {
      if (context?.previousAssignments) {
        queryClient.setQueryData(assignmentsKey, context.previousAssignments);
      }
      toast({ title: 'Error', description: 'Failed to update assignment', variant: 'destructive' });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Assignment updated' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: assignmentsKey });
    }
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: assignmentsKey });
      const previousAssignments = queryClient.getQueryData<Assignment[]>(assignmentsKey);
      
      queryClient.setQueryData<Assignment[]>(assignmentsKey, (old) => 
        (old || []).filter(a => a.id !== id)
      );
      return { previousAssignments };
    },
    onError: (err, id, context) => {
      if (context?.previousAssignments) {
        queryClient.setQueryData(assignmentsKey, context.previousAssignments);
      }
      toast({ title: 'Error', description: 'Failed to delete assignment', variant: 'destructive' });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Assignment deleted' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: assignmentsKey });
    }
  });

  const submitAssignmentMutation = useMutation({
    mutationFn: async ({ assignmentId, reflection }: { assignmentId: string; reflection: string }) => {
      const { data, error } = await supabase.from('submissions').insert({
        assignment_id: assignmentId,
        student_id: user!.id,
        reflection: reflection.trim(),
        duration_seconds: 0
      }).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ assignmentId, reflection }) => {
      await queryClient.cancelQueries({ queryKey: submissionsKey });
      const previousSubmissions = queryClient.getQueryData<Submission[]>(submissionsKey);
      
      const optimisticSubmission: Submission = {
        id: `temp-${Date.now()}`,
        assignment_id: assignmentId,
        completed_at: new Date().toISOString(),
        duration_seconds: 0,
        reflection: reflection.trim()
      };
      
      queryClient.setQueryData<Submission[]>(submissionsKey, (old) => [...(old || []), optimisticSubmission]);
      return { previousSubmissions };
    },
    onError: (err, variables, context) => {
      if (context?.previousSubmissions) {
        queryClient.setQueryData(submissionsKey, context.previousSubmissions);
      }
      toast({ title: 'Error', description: 'Failed to submit assignment', variant: 'destructive' });
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Assignment completed!' });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: submissionsKey });
      queryClient.invalidateQueries({ queryKey: ['student-stats'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
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
