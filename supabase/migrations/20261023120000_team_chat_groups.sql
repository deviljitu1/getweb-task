BEGIN;
CREATE TABLE public.chat_groups(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100), created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.chat_group_members(group_id uuid REFERENCES public.chat_groups(id) ON DELETE CASCADE, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, role text NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member')), joined_at timestamptz NOT NULL DEFAULT now(), last_read_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(group_id,user_id));
ALTER TABLE public.messages ADD COLUMN group_id uuid REFERENCES public.chat_groups(id);
ALTER TABLE public.messages ADD CONSTRAINT messages_group_receiver CHECK(group_id IS NULL OR receiver_id IS NULL);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.tasks ADD CONSTRAINT tasks_checklist_array CHECK(jsonb_typeof(checklist)='array');
CREATE INDEX messages_conversation_date_idx ON public.messages(sender_id,receiver_id,created_at DESC);
CREATE INDEX messages_group_date_idx ON public.messages(group_id,created_at DESC);
CREATE INDEX messages_unread_receiver_idx ON public.messages(receiver_id,sender_id) WHERE NOT is_read;
CREATE INDEX chat_group_members_user_idx ON public.chat_group_members(user_id);
CREATE FUNCTION public.is_chat_group_member(target_group uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_active_user() AND EXISTS(SELECT 1 FROM public.chat_group_members WHERE group_id=target_group AND user_id=auth.uid()) $$;
CREATE FUNCTION public.is_chat_group_admin(target_group uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public.is_active_user() AND EXISTS(SELECT 1 FROM public.chat_group_members WHERE group_id=target_group AND user_id=auth.uid() AND role='admin') $$;
ALTER TABLE public.chat_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Group members read groups" ON public.chat_groups FOR SELECT TO authenticated USING(public.is_chat_group_member(id));
CREATE POLICY "Group members read membership" ON public.chat_group_members FOR SELECT TO authenticated USING(public.is_chat_group_member(group_id));
REVOKE ALL ON public.chat_groups,public.chat_group_members FROM anon,authenticated;
GRANT SELECT ON public.chat_groups,public.chat_group_members TO authenticated;
GRANT ALL ON public.chat_groups,public.chat_group_members TO service_role;
CREATE FUNCTION public.create_chat_group(group_name text, member_ids uuid[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid; member uuid;
BEGIN
  IF NOT public.is_active_user() THEN RAISE EXCEPTION 'Active account required'; END IF;
  IF coalesce(length(trim(group_name)),0) NOT BETWEEN 1 AND 100 OR coalesce(cardinality(member_ids),0)>49 THEN RAISE EXCEPTION 'Group name and at most 49 other members required'; END IF;
  INSERT INTO public.chat_groups(name,created_by) VALUES(trim(group_name),auth.uid()) RETURNING id INTO result;
  INSERT INTO public.chat_group_members(group_id,user_id,role) VALUES(result,auth.uid(),'admin');
  FOREACH member IN ARRAY coalesce(member_ids,'{}') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=member AND is_active) THEN RAISE EXCEPTION 'Member account is unavailable'; END IF;
    INSERT INTO public.chat_group_members(group_id,user_id) VALUES(result,member) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN result;
END $$;
CREATE FUNCTION public.update_chat_group(target_group uuid, group_name text, member_ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE member uuid;
BEGIN
  PERFORM 1 FROM public.chat_groups WHERE id=target_group FOR UPDATE;
  IF NOT public.is_chat_group_admin(target_group) THEN RAISE EXCEPTION 'Group administrator access required'; END IF;
  IF coalesce(length(trim(group_name)),0) NOT BETWEEN 1 AND 100 OR coalesce(cardinality(member_ids),0)>50 THEN RAISE EXCEPTION 'Invalid group details'; END IF;
  UPDATE public.chat_groups SET name=trim(group_name) WHERE id=target_group;
  DELETE FROM public.chat_group_members WHERE group_id=target_group AND role<>'admin' AND NOT(user_id=ANY(coalesce(member_ids,'{}')));
  FOREACH member IN ARRAY coalesce(member_ids,'{}') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=member AND is_active) THEN RAISE EXCEPTION 'Member account is unavailable'; END IF;
    INSERT INTO public.chat_group_members(group_id,user_id) VALUES(target_group,member) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
CREATE FUNCTION public.mark_chat_group_read(target_group uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
  UPDATE public.chat_group_members SET last_read_at=now() WHERE group_id=target_group AND user_id=auth.uid();
END $$;
GRANT UPDATE(last_read_at) ON public.chat_group_members TO authenticated;
CREATE POLICY "Members mark own group read" ON public.chat_group_members FOR UPDATE TO authenticated USING(user_id=auth.uid() AND public.is_active_user()) WITH CHECK(user_id=auth.uid() AND public.is_active_user());
CREATE FUNCTION public.chat_group_unread() RETURNS TABLE(group_id uuid, unread_count bigint) LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT gm.group_id,count(m.id) FROM public.chat_group_members gm LEFT JOIN public.messages m ON m.group_id=gm.group_id AND m.created_at>gm.last_read_at AND m.sender_id<>auth.uid() WHERE gm.user_id=auth.uid() GROUP BY gm.group_id $$;

-- Restrictive policies also protect custom groups if older permissive policies remain.
CREATE POLICY "Restrict chat reads to participants" ON public.messages AS RESTRICTIVE FOR SELECT TO authenticated USING(public.is_active_user() AND ((group_id IS NOT NULL AND public.is_chat_group_member(group_id)) OR (group_id IS NULL AND (receiver_id IS NULL OR sender_id=auth.uid() OR receiver_id=auth.uid()))));
CREATE POLICY "Members read their custom groups" ON public.messages FOR SELECT TO authenticated USING(group_id IS NOT NULL AND public.is_chat_group_member(group_id));
CREATE POLICY "Restrict chat inserts to participants" ON public.messages AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(sender_id=auth.uid() AND public.is_active_user() AND (group_id IS NULL OR public.is_chat_group_member(group_id)));
CREATE POLICY "Members send to their custom groups" ON public.messages FOR INSERT TO authenticated WITH CHECK(sender_id=auth.uid() AND receiver_id IS NULL AND group_id IS NOT NULL AND public.is_chat_group_member(group_id));
CREATE POLICY "Restrict chat updates to participants" ON public.messages AS RESTRICTIVE FOR UPDATE TO authenticated USING(public.is_active_user() AND (sender_id=auth.uid() OR receiver_id=auth.uid()) AND (group_id IS NULL OR public.is_chat_group_member(group_id))) WITH CHECK(public.is_active_user() AND (sender_id=auth.uid() OR receiver_id=auth.uid()) AND (group_id IS NULL OR public.is_chat_group_member(group_id)));
CREATE FUNCTION public.prevent_chat_route_change() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
  IF NEW.group_id IS DISTINCT FROM OLD.group_id THEN RAISE EXCEPTION 'Message conversation cannot be changed'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER prevent_chat_route_change BEFORE UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.prevent_chat_route_change();

CREATE POLICY "Active team private channel reads" ON realtime.messages FOR SELECT TO authenticated USING(public.is_active_user() AND (realtime.topic()='team-chat:group' OR realtime.topic()='team-chat:user:'||auth.uid()::text OR realtime.topic()='team-presence'));
CREATE POLICY "Active team presence" ON realtime.messages FOR INSERT TO authenticated WITH CHECK(public.is_active_user() AND realtime.topic()='team-presence' AND extension='presence');
CREATE FUNCTION public.broadcast_team_message() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE msg public.messages; event_data jsonb; member uuid;
BEGIN
  IF TG_OP='DELETE' THEN msg:=OLD; ELSE msg:=NEW; END IF;
  event_data:=jsonb_build_object('id',msg.id,'sender_id',msg.sender_id,'receiver_id',msg.receiver_id,'group_id',msg.group_id,'event',TG_OP);
  IF msg.group_id IS NOT NULL THEN
    FOR member IN SELECT user_id FROM public.chat_group_members WHERE group_id=msg.group_id LOOP PERFORM realtime.send(event_data,'message_changed','team-chat:user:'||member::text,true); END LOOP;
  ELSIF msg.receiver_id IS NULL THEN PERFORM realtime.send(event_data,'message_changed','team-chat:group',true);
  ELSE
    PERFORM realtime.send(event_data,'message_changed','team-chat:user:'||msg.sender_id::text,true);
    IF msg.receiver_id<>msg.sender_id THEN PERFORM realtime.send(event_data,'message_changed','team-chat:user:'||msg.receiver_id::text,true); END IF;
  END IF; RETURN NULL;
END $$;
CREATE TRIGGER broadcast_team_message AFTER INSERT OR UPDATE OR DELETE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.broadcast_team_message();
REVOKE ALL ON FUNCTION public.broadcast_team_message(),public.prevent_chat_route_change() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.is_chat_group_member(uuid),public.is_chat_group_admin(uuid),public.create_chat_group(text,uuid[]),public.update_chat_group(uuid,text,uuid[]),public.mark_chat_group_read(uuid),public.chat_group_unread() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.is_chat_group_member(uuid),public.is_chat_group_admin(uuid),public.create_chat_group(text,uuid[]),public.update_chat_group(uuid,text,uuid[]),public.mark_chat_group_read(uuid),public.chat_group_unread() TO authenticated;
UPDATE storage.buckets SET public=false,file_size_limit=10485760 WHERE id='chat-attachments';
CREATE POLICY "Restrict chat attachment reads" ON storage.objects AS RESTRICTIVE FOR SELECT TO public USING(bucket_id<>'chat-attachments' OR (public.is_active_user() AND ((storage.foldername(name))[1]=auth.uid()::text OR EXISTS(SELECT 1 FROM public.messages m WHERE m.attachment_url=storage.objects.name OR m.attachment_url LIKE '%/chat-attachments/'||storage.objects.name))));
CREATE POLICY "Restrict chat attachment uploads" ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'chat-attachments' OR (public.is_active_user() AND (storage.foldername(name))[1]=auth.uid()::text));
NOTIFY pgrst,'reload schema';
COMMIT;
