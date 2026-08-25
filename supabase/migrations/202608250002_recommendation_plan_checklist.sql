create policy "Users can update own recommendation plan"
on public.recommendation_results for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

comment on column public.recommendation_results.daily_plan is
  'JSON object for today plan content. Current keys include priorities, avoid, and checklist. checklist items include id, label, sectionTitle, and completed.';
