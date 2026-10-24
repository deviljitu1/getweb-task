-- Calls are received only by their recipient. Only the server broadcasts signals.
CREATE POLICY "Team members receive their own call signals"
ON realtime.messages FOR SELECT TO authenticated
USING (public.is_active_user() AND realtime.topic() = 'team-calls:user:' || auth.uid()::text);
