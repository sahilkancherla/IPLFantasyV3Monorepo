-- Fix handle_new_user trigger to handle username conflicts gracefully
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
DECLARE
  base_username TEXT;
  final_username TEXT;
  suffix INTEGER := 1;
BEGIN
  base_username := regexp_replace(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g');
  final_username := base_username;

  -- Find a unique username by appending a number if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    final_username := base_username || suffix;
    suffix := suffix + 1;
  END LOOP;

  INSERT INTO public.profiles (id, username, full_name, display_name)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', base_username),
    COALESCE(NEW.raw_user_meta_data->>'full_name', base_username)
  )
  ON CONFLICT (id) DO UPDATE
    SET username    = EXCLUDED.username,
        full_name   = EXCLUDED.full_name,
        display_name = EXCLUDED.display_name;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
