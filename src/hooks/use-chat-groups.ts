import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useChatGroups() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['chat-groups', user?.userId], enabled: !!user, queryFn: async () => {
    const [groups, membership] = await Promise.all([supabase.from('chat_groups').select('*').order('created_at', { ascending: false }), supabase.from('chat_group_members').select('*')]);
    if (groups.error) throw groups.error; if (membership.error) throw membership.error;
    return { groups: groups.data, membership: membership.data };
  } });
}
