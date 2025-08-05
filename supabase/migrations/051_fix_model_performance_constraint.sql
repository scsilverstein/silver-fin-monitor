-- Fix the model_performance table to work with the trigger
-- The trigger uses ON CONFLICT (model_name, task_type) but there's no unique constraint

-- Add the unique constraint that the trigger expects
ALTER TABLE model_performance 
ADD CONSTRAINT unique_model_performance_model_task 
UNIQUE (model_name, task_type);