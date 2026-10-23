BEGIN;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles(user_id,name,employee_type,is_active)
  VALUES(NEW.id,coalesce(NEW.raw_user_meta_data->>'name',NEW.email),coalesce((NEW.raw_user_meta_data->>'employee_type')::public.employee_type,'Other'),coalesce(NEW.raw_app_meta_data->>'role' IN ('admin','employee'),false));
  INSERT INTO public.user_roles(user_id,role)
  VALUES(NEW.id,CASE WHEN NEW.raw_app_meta_data->>'role'='admin' THEN 'admin'::public.app_role ELSE 'employee'::public.app_role END);
  RETURN NEW;
END $$;

ALTER TABLE public.finance_entries ADD CONSTRAINT finance_settlement_direction_required CHECK(kind<>'settlement' OR (direction IS NOT NULL AND direction IN ('company_owes','member_owes')));
ALTER TABLE public.finance_entries ADD CONSTRAINT finance_investment_direction_required CHECK(kind<>'investment' OR (direction IS NOT NULL AND direction IN ('contribution','withdrawal','purchase','sale')));

-- Membership changes pass through the authenticated call service so removed callers are disconnected.
REVOKE EXECUTE ON FUNCTION public.update_chat_group(uuid,text,uuid[]) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.update_chat_group_server(actor_id uuid,target_group uuid,group_name text,member_ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',actor_id::text,true);
  PERFORM public.update_chat_group(target_group,group_name,member_ids);
  IF (SELECT count(*) FROM public.chat_group_members WHERE group_id=target_group)>50 THEN RAISE EXCEPTION 'A group supports at most 50 members'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.update_chat_group_server(uuid,uuid,text,uuid[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.update_chat_group_server(uuid,uuid,text,uuid[]) TO service_role;
CREATE OR REPLACE FUNCTION public.create_chat_group(group_name text, member_ids uuid[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid; member uuid;
BEGIN
  IF NOT public.is_active_user() THEN RAISE EXCEPTION 'Active account required'; END IF;
  IF coalesce(length(trim(group_name)),0) NOT BETWEEN 1 AND 100 OR coalesce(cardinality(member_ids),0)>50 THEN RAISE EXCEPTION 'Group name and at most 50 members required'; END IF;
  INSERT INTO public.chat_groups(name,created_by) VALUES(trim(group_name),auth.uid()) RETURNING id INTO result;
  INSERT INTO public.chat_group_members(group_id,user_id,role) VALUES(result,auth.uid(),'admin');
  FOREACH member IN ARRAY coalesce(member_ids,'{}') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=member AND is_active) THEN RAISE EXCEPTION 'Member account is unavailable'; END IF;
    INSERT INTO public.chat_group_members(group_id,user_id) VALUES(result,member) ON CONFLICT DO NOTHING;
  END LOOP;
  IF (SELECT count(*) FROM public.chat_group_members WHERE group_id=result)>50 THEN RAISE EXCEPTION 'A group supports at most 50 members'; END IF;
  RETURN result;
END $$;
COMMIT;
