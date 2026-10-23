BEGIN;
CREATE FUNCTION public.automate_task(task_action text,target_task uuid,details jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE target public.tasks; actor uuid:=auth.uid(); admin_user boolean; now_ms bigint:=floor(extract(epoch FROM clock_timestamp())*1000); session_id uuid; stopped integer:=0;
BEGIN
  IF NOT public.is_active_user() THEN RAISE EXCEPTION 'An enabled team account is required'; END IF;
  IF task_action NOT IN ('start','stop','complete') THEN RAISE EXCEPTION 'Invalid task action'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
  SELECT * INTO target FROM public.tasks WHERE id=target_task FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found or inaccessible'; END IF;
  admin_user:=public.has_role(actor,'admin');
  IF target.user_id<>actor AND NOT admin_user THEN RAISE EXCEPTION 'You can only manage your own tasks'; END IF;
  IF task_action='start' THEN
    IF target.user_id<>actor THEN RAISE EXCEPTION 'Start timers only for your own work'; END IF;
    UPDATE public.time_sessions SET end_time=greatest(start_time,now_ms) WHERE created_by=actor AND task_id<>target_task AND end_time IS NULL;
    SELECT id INTO session_id FROM public.time_sessions WHERE task_id=target_task AND created_by=actor AND end_time IS NULL LIMIT 1;
    IF session_id IS NULL THEN INSERT INTO public.time_sessions(task_id,created_by,start_time) VALUES(target_task,actor,now_ms) RETURNING id INTO session_id; END IF;
    UPDATE public.tasks SET status='In Progress' WHERE id=target_task;
  ELSE
    UPDATE public.time_sessions SET end_time=greatest(start_time,now_ms) WHERE task_id=target_task AND end_time IS NULL;
    GET DIAGNOSTICS stopped=ROW_COUNT;
    IF task_action='complete' THEN
      IF coalesce(length(details->>'completion_notes'),0)>5000 OR coalesce(length(details->>'project_link'),0)>2000 THEN RAISE EXCEPTION 'Completion details are too long'; END IF;
      IF details ? 'project_link' AND details->>'project_link' !~ '^https?://' THEN RAISE EXCEPTION 'Project links must use HTTP or HTTPS'; END IF;
      UPDATE public.tasks SET status='Finished',
        approval_status=CASE WHEN target.status='Finished' THEN target.approval_status WHEN admin_user THEN 'Approved'::public.approval_status ELSE 'Pending'::public.approval_status END,
        completion_notes=coalesce(details->>'completion_notes',completion_notes),project_link=coalesce(details->>'project_link',project_link)
      WHERE id=target_task;
    END IF;
  END IF;
  RETURN jsonb_build_object('task',(SELECT to_jsonb(t) FROM public.tasks t WHERE id=target_task),'session_id',session_id,'stopped_sessions',stopped);
END $$;
REVOKE ALL ON FUNCTION public.automate_task(text,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.automate_task(text,uuid,jsonb) TO authenticated;
COMMIT;
