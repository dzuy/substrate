create policy "Users can insert own analysis"
on public.analysis_results for insert
with check (auth.uid() = user_id);

create policy "Users can insert own recommendations"
on public.recommendation_results for insert
with check (auth.uid() = user_id);
