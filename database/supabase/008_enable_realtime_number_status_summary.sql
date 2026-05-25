-- Enable realtime for number status summary

ALTER PUBLICATION supabase_realtime
ADD TABLE public.number_status_summary;

ALTER TABLE public.number_status_summary REPLICA IDENTITY FULL;

-- Optional but recommended:
ALTER PUBLICATION supabase_realtime
ADD TABLE public.payment_holds;

ALTER PUBLICATION supabase_realtime
ADD TABLE public.payment_hold_items;

ALTER PUBLICATION supabase_realtime
ADD TABLE public.submissions;
